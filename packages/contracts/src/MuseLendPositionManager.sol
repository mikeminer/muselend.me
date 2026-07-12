// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { MuseLendUSDCVault } from "./MuseLendUSDCVault.sol";
import { MuseLendHedgeEpochVault } from "./MuseLendHedgeEpochVault.sol";
import { MuseLendPositionReceipt } from "./MuseLendPositionReceipt.sol";
import { MuseLendRiskManager } from "./MuseLendRiskManager.sol";
import { CreatorTokenValidator } from "./CreatorTokenValidator.sol";
import { ISwapAdapter } from "./interfaces/ISwapAdapter.sol";

/// @title MuseLend position manager
/// @notice Atomically sells canonical creator tokens before originating covered USDC debt.
contract MuseLendPositionManager is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;
    bytes32 public constant ADAPTER_ADMIN_ROLE = keccak256("ADAPTER_ADMIN_ROLE");
    uint256 public constant BPS = 10_000;
    uint256 public constant RAY = 1e27;
    uint256 public constant YEAR = 365 days;
    uint32 public constant GRACE_PERIOD = 3 days;
    uint16 public constant KEEPER_BOUNTY_BPS = 50;
    uint256 public constant MAX_KEEPER_BOUNTY = 5e6;

    enum State {
        None,
        Open,
        Settling,
        Closed,
        Defaulted
    }

    struct Position {
        address owner;
        address creatorToken;
        address adapter;
        uint128 syntheticAmount;
        uint128 saleProceeds;
        uint128 principal;
        uint128 debtShares;
        uint128 coverageCap;
        uint128 juniorCoverage;
        uint128 premium;
        uint128 originationFee;
        uint40 openedAt;
        uint40 maturity;
        uint32 term;
        uint32 epochId;
        uint128 maxDebt;
        State state;
    }

    struct OpenParams {
        address creatorToken;
        address adapter;
        uint256 amount;
        uint256 minUsdcOut;
        uint256 principal;
        uint32 term;
        uint32 epochId;
        uint256 deadline;
        ISwapAdapter.Route route;
    }

    error InvalidPosition();
    error InvalidToken();
    error InvalidAdapter();
    error InvalidAmount();
    error RiskPaused();
    error Slippage();
    error CoverageViolation();
    error NotPositionOwner();
    error PositionNotExpired();
    error DebtNotRepaid();

    IERC20 public immutable usdc;
    MuseLendUSDCVault public immutable seniorVault;
    MuseLendHedgeEpochVault public immutable hedgeVault;
    MuseLendPositionReceipt public immutable receipt;
    MuseLendRiskManager public immutable riskManager;
    CreatorTokenValidator public immutable tokenValidator;
    address public immutable feeRecipient;
    uint256 public nextPositionId = 1;
    uint256 public totalReservedUsdc;
    mapping(uint256 => Position) public positions;
    mapping(address => bool) public allowedAdapter;
    mapping(address => uint256) public tokenExposure;
    mapping(address => uint256) public walletExposure;

    event AdapterUpdated(address indexed adapter, bool allowed);
    event PositionOpened(
        uint256 indexed positionId,
        address indexed owner,
        address indexed creatorToken,
        uint256 tokenAmount,
        uint256 saleProceeds,
        uint256 principal,
        uint256 coverageCap,
        uint256 juniorCoverage,
        uint256 premium,
        uint256 originationFee
    );
    event PositionRepaid(uint256 indexed positionId, uint256 amount);
    event PositionClosed(
        uint256 indexed positionId, uint256 creatorTokensReturned, uint256 buybackCost, uint256 topUp
    );
    event PositionDefaulted(
        uint256 indexed positionId, uint256 seniorPayment, uint256 keeperBounty, uint256 juniorPnl
    );

    constructor(
        IERC20 usdc_,
        MuseLendUSDCVault seniorVault_,
        MuseLendHedgeEpochVault hedgeVault_,
        MuseLendPositionReceipt receipt_,
        MuseLendRiskManager riskManager_,
        CreatorTokenValidator validator_,
        address admin,
        address adapterAdmin,
        address initialAdapter,
        address feeRecipient_
    ) {
        if (admin == address(0) || adapterAdmin == address(0) || initialAdapter == address(0)) {
            revert InvalidAdapter();
        }
        if (feeRecipient_ == address(0)) revert InvalidAmount();
        usdc = usdc_;
        seniorVault = seniorVault_;
        hedgeVault = hedgeVault_;
        receipt = receipt_;
        riskManager = riskManager_;
        tokenValidator = validator_;
        feeRecipient = feeRecipient_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADAPTER_ADMIN_ROLE, adapterAdmin);
        allowedAdapter[initialAdapter] = true;
        emit AdapterUpdated(initialAdapter, true);
    }

    function setAdapter(address adapter, bool allowed) external onlyRole(ADAPTER_ADMIN_ROLE) {
        if (adapter == address(0)) revert InvalidAdapter();
        allowedAdapter[adapter] = allowed;
        emit AdapterUpdated(adapter, allowed);
    }

    // Balance deltas authenticate adapter return values; nonReentrant guards the full transaction.
    // slither-disable-start reentrancy-balance,reentrancy-no-eth,reentrancy-benign
    function openPosition(OpenParams calldata p) external nonReentrant returns (uint256 id) {
        if (riskManager.openingsPaused()) revert RiskPaused();
        if (!allowedAdapter[p.adapter]) revert InvalidAdapter();
        if (p.amount == 0 || p.amount > type(uint128).max || p.principal == 0 || block.timestamp > p.deadline)
        {
            revert InvalidAmount();
        }
        if (p.route.creatorToken != p.creatorToken || p.route.usdc != address(usdc)) revert InvalidAdapter();
        MuseLendRiskManager.TokenConfig memory c = riskManager.getTokenConfig(p.creatorToken);
        if (!c.enabled || !tokenValidator.validate(p.creatorToken, c.canonicalZoraVersion)) {
            revert InvalidToken();
        }
        uint16 premiumBps = riskManager.termPremium(p.creatorToken, p.term);
        IERC20 token = IERC20(p.creatorToken);
        uint256 tokenBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), p.amount);
        if (token.balanceOf(address(this)) - tokenBefore != p.amount) revert InvalidToken();
        token.forceApprove(p.adapter, p.amount);
        uint256 beforeUsdc = usdc.balanceOf(address(this));
        uint256 adapterProceeds =
            ISwapAdapter(p.adapter).sellExactInput(p.route, p.amount, p.minUsdcOut, p.deadline);
        uint256 proceeds = usdc.balanceOf(address(this)) - beforeUsdc;
        if (adapterProceeds != proceeds) revert Slippage();
        if (proceeds > type(uint128).max) revert InvalidAmount();
        if (proceeds < p.minUsdcOut || proceeds < c.minimumPositionUsdc || proceeds > c.maximumPositionUsdc) {
            revert Slippage();
        }
        uint256 cap = Math.mulDiv(proceeds, c.coverageCapBps, BPS);
        uint256 junior = cap - proceeds;
        if (p.principal > Math.mulDiv(proceeds, c.advanceRateBps, BPS)) revert CoverageViolation();
        if (
            seniorVault.totalPrincipalOutstanding() + p.principal > riskManager.globalSeniorDebtCap()
                || hedgeVault.totalLockedCoverage() + junior > riskManager.globalJuniorCoverageCap()
        ) revert CoverageViolation();
        uint256 duration = uint256(p.term) + GRACE_PERIOD;
        uint256 maxDebt = p.principal
            + Math.mulDiv(
                Math.mulDiv(p.principal, seniorVault.rateModel().maxBorrowRateRay(), RAY, Math.Rounding.Ceil),
                duration,
                YEAR,
                Math.Rounding.Ceil
            );
        if (maxDebt > Math.mulDiv(proceeds, c.seniorCoverageBps, BPS)) revert CoverageViolation();
        if (
            tokenExposure[p.creatorToken] + proceeds > c.maximumTokenExposureUsdc
                || walletExposure[msg.sender] + proceeds > c.maximumWalletExposureUsdc
        ) revert CoverageViolation();
        id = nextPositionId++;
        uint40 maturity = uint40(block.timestamp + p.term);
        hedgeVault.lockCoverage(p.epochId, id, junior, uint40(uint256(maturity) + GRACE_PERIOD));
        uint256 premium = Math.mulDiv(junior, premiumBps, BPS, Math.Rounding.Ceil);
        uint256 originationFee =
            Math.mulDiv(p.principal, riskManager.originationFeeBps(), BPS, Math.Rounding.Ceil);
        if (premium + originationFee >= p.principal) revert CoverageViolation();
        uint256 shares = seniorVault.originate(id, address(this), p.principal);
        if (
            shares > type(uint128).max || cap > type(uint128).max || junior > type(uint128).max
                || maxDebt > type(uint128).max
        ) {
            revert InvalidAmount();
        }
        usdc.safeTransfer(address(hedgeVault), premium);
        hedgeVault.recordPremium(p.epochId, id, premium);
        if (originationFee > 0) usdc.safeTransfer(feeRecipient, originationFee);
        usdc.safeTransfer(msg.sender, p.principal - premium - originationFee);
        positions[id] = Position(
            msg.sender,
            p.creatorToken,
            p.adapter,
            p.amount.toUint128(),
            proceeds.toUint128(),
            p.principal.toUint128(),
            shares.toUint128(),
            cap.toUint128(),
            junior.toUint128(),
            premium.toUint128(),
            originationFee.toUint128(),
            uint40(block.timestamp),
            maturity,
            p.term,
            uint32(p.epochId),
            maxDebt.toUint128(),
            State.Open
        );
        totalReservedUsdc += proceeds;
        tokenExposure[p.creatorToken] += proceeds;
        walletExposure[msg.sender] += proceeds;
        receipt.mint(msg.sender, id);
        emit PositionOpened(
            id,
            msg.sender,
            p.creatorToken,
            p.amount,
            proceeds,
            p.principal,
            cap,
            junior,
            premium,
            originationFee
        );
    }
    // slither-disable-end reentrancy-balance,reentrancy-no-eth,reentrancy-benign

    function currentDebt(uint256 id) public view returns (uint256) {
        Position storage p = positions[id];
        if (p.state != State.Open) revert InvalidPosition();
        if (p.debtShares == 0) return 0;
        return Math.min(seniorVault.debtForShares(p.debtShares), p.maxDebt);
    }

    function repay(uint256 id) external nonReentrant returns (uint256 amount) {
        Position storage p = positions[id];
        if (p.owner != msg.sender) revert NotPositionOwner();
        amount = _repay(p, id, msg.sender);
    }

    function _repay(Position storage p, uint256 id, address payer) internal returns (uint256 amount) {
        if (p.debtShares == 0) return 0;
        uint256 debtShares = p.debtShares;
        p.debtShares = 0;
        amount = Math.min(seniorVault.debtForShares(debtShares), p.maxDebt);
        usdc.safeTransferFrom(payer, address(seniorVault), amount);
        seniorVault.recordRepayment(id, debtShares, p.principal, amount);
        emit PositionRepaid(id, amount);
    }

    // State enters Settling before the adapter call and nonReentrant prevents callback entry.
    // slither-disable-start reentrancy-balance,reentrancy-no-eth
    function closeFull(uint256 id, uint256 maxTopUp, uint256 deadline, ISwapAdapter.Route calldata route)
        external
        nonReentrant
        returns (uint256 cost)
    {
        Position storage p = positions[id];
        if (p.owner != msg.sender) revert NotPositionOwner();
        _validateCloseRoute(p, route, deadline);
        p.state = State.Settling;
        _repay(p, id, msg.sender);
        if (maxTopUp > 0) usdc.safeTransferFrom(msg.sender, address(this), maxTopUp);
        hedgeVault.drawCoverage(p.epochId, p.juniorCoverage, address(this));
        uint256 budget = uint256(p.coverageCap) + maxTopUp;
        usdc.forceApprove(p.adapter, budget);
        uint256 beforeUsdc = usdc.balanceOf(address(this));
        uint256 beforeToken = IERC20(p.creatorToken).balanceOf(address(this));
        uint256 adapterCost =
            ISwapAdapter(p.adapter).buyExactOutput(route, p.syntheticAmount, budget, deadline);
        cost = beforeUsdc - usdc.balanceOf(address(this));
        if (
            adapterCost != cost || cost > budget
                || IERC20(p.creatorToken).balanceOf(address(this)) - beforeToken != p.syntheticAmount
        ) {
            revert Slippage();
        }
        uint256 reserveSpent = Math.min(cost, p.saleProceeds);
        uint256 juniorSpent = Math.min(cost - reserveSpent, p.juniorCoverage);
        uint256 topUpSpent = cost - reserveSpent - juniorSpent;
        uint256 juniorReturn = uint256(p.juniorCoverage) - juniorSpent;
        uint256 pnl = uint256(p.saleProceeds) - reserveSpent;
        usdc.safeTransfer(address(hedgeVault), juniorReturn + pnl);
        if (maxTopUp > topUpSpent) usdc.safeTransfer(msg.sender, maxTopUp - topUpSpent);
        hedgeVault.settleCoverage(p.epochId, id, p.juniorCoverage, juniorSpent, pnl.toInt256(), 0);
        IERC20(p.creatorToken).safeTransfer(msg.sender, p.syntheticAmount);
        _finalize(p, id, State.Closed);
        emit PositionClosed(id, p.syntheticAmount, cost, topUpSpent);
    }

    // slither-disable-end reentrancy-balance,reentrancy-no-eth

    // State enters Settling before the adapter call and nonReentrant prevents callback entry.
    // slither-disable-start reentrancy-balance,reentrancy-no-eth
    function closeCapped(uint256 id, uint256 minTokenOut, uint256 deadline, ISwapAdapter.Route calldata route)
        external
        nonReentrant
        returns (uint256 tokenOut)
    {
        Position storage p = positions[id];
        if (p.owner != msg.sender) revert NotPositionOwner();
        _validateCloseRoute(p, route, deadline);
        p.state = State.Settling;
        _repay(p, id, msg.sender);
        hedgeVault.drawCoverage(p.epochId, p.juniorCoverage, address(this));
        usdc.forceApprove(p.adapter, p.coverageCap);
        uint256 beforeToken = IERC20(p.creatorToken).balanceOf(address(this));
        uint256 adapterTokenOut =
            ISwapAdapter(p.adapter).buyExactInput(route, p.coverageCap, minTokenOut, deadline);
        tokenOut = IERC20(p.creatorToken).balanceOf(address(this)) - beforeToken;
        if (adapterTokenOut != tokenOut || tokenOut < minTokenOut) revert Slippage();
        hedgeVault.settleCoverage(p.epochId, id, p.juniorCoverage, p.juniorCoverage, 0, 0);
        IERC20(p.creatorToken).safeTransfer(msg.sender, tokenOut);
        _finalize(p, id, State.Closed);
        emit PositionClosed(id, tokenOut, p.coverageCap, 0);
    }

    // slither-disable-end reentrancy-balance,reentrancy-no-eth

    // nonReentrant and the Settling transition protect the effects around trusted vault calls.
    // slither-disable-start reentrancy-no-eth
    function settleExpiredPosition(uint256 id) external nonReentrant {
        Position storage p = positions[id];
        if (p.state != State.Open) revert InvalidPosition();
        if (block.timestamp <= uint256(p.maturity) + GRACE_PERIOD) revert PositionNotExpired();
        uint256 debt = currentDebt(id);
        if (debt > p.saleProceeds) revert CoverageViolation();
        p.state = State.Settling;
        usdc.safeTransfer(address(seniorVault), debt);
        seniorVault.recordRepayment(id, p.debtShares, p.principal, debt);
        uint256 residual = uint256(p.saleProceeds) - debt;
        uint256 bounty = Math.min(Math.mulDiv(residual, KEEPER_BOUNTY_BPS, BPS), MAX_KEEPER_BOUNTY);
        if (bounty > 0) usdc.safeTransfer(msg.sender, bounty);
        uint256 pnl = residual - bounty;
        if (pnl > 0) usdc.safeTransfer(address(hedgeVault), pnl);
        hedgeVault.settleCoverage(p.epochId, id, p.juniorCoverage, 0, pnl.toInt256(), 0);
        _finalize(p, id, State.Defaulted);
        emit PositionDefaulted(id, debt, bounty, pnl);
    }
    // slither-disable-end reentrancy-no-eth

    function _finalize(Position storage p, uint256 id, State state) internal {
        totalReservedUsdc -= p.saleProceeds;
        tokenExposure[p.creatorToken] -= p.saleProceeds;
        walletExposure[p.owner] -= p.saleProceeds;
        p.state = state;
        receipt.burn(id);
    }

    function _validateCloseRoute(Position storage p, ISwapAdapter.Route calldata route, uint256 deadline)
        internal
        view
    {
        if (p.state != State.Open || !allowedAdapter[p.adapter] || block.timestamp > deadline) {
            revert InvalidPosition();
        }
        if (route.creatorToken != p.creatorToken || route.usdc != address(usdc)) revert InvalidAdapter();
    }
}
