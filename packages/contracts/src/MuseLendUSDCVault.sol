// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { InterestRateModel } from "./InterestRateModel.sol";

/// @title MuseLend senior USDC vault
/// @notice ERC-4626 cash vault with debt-share accounting and no administrative asset sweep.
contract MuseLendUSDCVault is ERC4626, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;
    bytes32 public constant MANAGER_ADMIN_ROLE = keccak256("MANAGER_ADMIN_ROLE");
    uint256 public constant RAY = 1e27;
    uint256 public constant YEAR = 365 days;
    error OnlyPositionManager();
    error ManagerAlreadySet();
    error InsufficientCash();
    error InvalidRepayment();

    address public positionManager;
    uint256 public totalPrincipalOutstanding;
    uint256 public totalDebtShares;
    uint256 public borrowIndex = RAY;
    uint40 public lastAccrual;
    uint256 public realizedInterest;
    uint256 public nextRequestId = 1;
    uint256 public nextRequestToProcess = 1;
    InterestRateModel public immutable rateModel;

    struct WithdrawalRequest {
        address owner;
        address receiver;
        uint128 shares;
        bool claimed;
    }
    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;

    event PositionManagerSet(address indexed manager);
    event PrincipalOriginated(
        uint256 indexed positionId, address indexed receiver, uint256 principal, uint256 debtShares
    );
    event DebtRepaid(uint256 indexed positionId, uint256 principal, uint256 interest, uint256 debtShares);
    event WithdrawalQueued(
        uint256 indexed requestId, address indexed owner, address indexed receiver, uint256 shares
    );
    event WithdrawalClaimed(uint256 indexed requestId, uint256 shares, uint256 assets);

    constructor(IERC20 usdc, address admin, InterestRateModel rateModel_)
        ERC20("MuseLend Senior USDC Vault", "msUSDC")
        ERC4626(usdc)
    {
        if (address(rateModel_) == address(0)) revert InvalidRepayment();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ADMIN_ROLE, admin);
        rateModel = rateModel_;
        lastAccrual = uint40(block.timestamp);
    }
    modifier onlyPositionManager() {
        if (msg.sender != positionManager) revert OnlyPositionManager();
        _;
    }

    function setPositionManager(address manager) external onlyRole(MANAGER_ADMIN_ROLE) {
        if (positionManager != address(0)) revert ManagerAlreadySet();
        if (manager == address(0)) revert OnlyPositionManager();
        positionManager = manager;
        emit PositionManagerSet(manager);
    }

    /// @dev Principal is a realized receivable; uncollected interest is deliberately excluded.
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + totalPrincipalOutstanding;
    }

    function availableCash() public view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    // Zero is the exact boundary for both elapsed time and the absence of debt shares.
    // slither-disable-next-line incorrect-equality
    function previewBorrowIndex() public view returns (uint256) {
        uint256 elapsed = block.timestamp - lastAccrual;
        if (elapsed == 0 || totalDebtShares == 0) return borrowIndex;
        uint256 debt = Math.mulDiv(totalDebtShares, borrowIndex, RAY, Math.Rounding.Ceil);
        uint256 rate = rateModel.borrowRate(availableCash(), debt);
        return borrowIndex
            + Math.mulDiv(
            Math.mulDiv(borrowIndex, rate, RAY, Math.Rounding.Ceil), elapsed, YEAR, Math.Rounding.Ceil
        );
    }

    function accrue() public returns (uint256 index) {
        index = previewBorrowIndex();
        borrowIndex = index;
        lastAccrual = uint40(block.timestamp);
    }

    function debtForShares(uint256 shares) public view returns (uint256) {
        return Math.mulDiv(shares, previewBorrowIndex(), RAY, Math.Rounding.Ceil);
    }

    function maxWithdraw(address owner) public view override returns (uint256) {
        return Math.min(super.maxWithdraw(owner), availableCash());
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        return Math.min(super.maxRedeem(owner), _convertToShares(availableCash(), Math.Rounding.Floor));
    }

    function originate(uint256 positionId, address receiver, uint256 principal)
        external
        onlyPositionManager
        nonReentrant
        returns (uint256 debtShares)
    {
        if (principal > availableCash()) revert InsufficientCash();
        uint256 index = accrue();
        debtShares = Math.mulDiv(principal, RAY, index, Math.Rounding.Ceil);
        totalDebtShares += debtShares;
        totalPrincipalOutstanding += principal;
        IERC20(asset()).safeTransfer(receiver, principal);
        emit PrincipalOriginated(positionId, receiver, principal, debtShares);
    }

    /// @notice Manager must transfer `amount` into the vault before recording repayment.
    function recordRepayment(uint256 positionId, uint256 debtShares, uint256 principal, uint256 amount)
        external
        onlyPositionManager
    {
        accrue();
        if (principal > totalPrincipalOutstanding || debtShares > totalDebtShares || amount < principal) {
            revert InvalidRepayment();
        }
        totalDebtShares -= debtShares;
        totalPrincipalOutstanding -= principal;
        uint256 interest = amount - principal;
        realizedInterest += interest;
        emit DebtRepaid(positionId, principal, interest, debtShares);
    }

    /// @notice Escrows vault shares in a FIFO queue without iterating over global requests.
    function requestRedeem(uint256 shares, address receiver)
        external
        nonReentrant
        returns (uint256 requestId)
    {
        if (shares == 0 || shares > type(uint128).max || receiver == address(0)) {
            revert InvalidRepayment();
        }
        requestId = nextRequestId++;
        _transfer(msg.sender, address(this), shares);
        withdrawalRequests[requestId] = WithdrawalRequest(msg.sender, receiver, shares.toUint128(), false);
        emit WithdrawalQueued(requestId, msg.sender, receiver, shares);
    }

    /// @notice Processes exactly one FIFO request; callers can retry when cash returns.
    function claimNextWithdrawal() external nonReentrant returns (uint256 assets) {
        uint256 requestId = nextRequestToProcess;
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        if (request.owner == address(0) || request.claimed) revert InvalidRepayment();
        assets = previewRedeem(request.shares);
        if (assets > availableCash()) revert InsufficientCash();
        request.claimed = true;
        nextRequestToProcess = requestId + 1;
        _burn(address(this), request.shares);
        IERC20(asset()).safeTransfer(request.receiver, assets);
        emit WithdrawalClaimed(requestId, request.shares, assets);
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return 3;
    }
}
