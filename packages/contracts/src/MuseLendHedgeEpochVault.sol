// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title Fixed-epoch junior hedge vault
/// @notice Epoch shares are non-transferable and redeemable only after every liability settles.
contract MuseLendHedgeEpochVault is ERC1155, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    bytes32 public constant EPOCH_ADMIN_ROLE = keccak256("EPOCH_ADMIN_ROLE");
    error InvalidEpoch();
    error EpochNotOpen();
    error CoverageUnavailable();
    error OnlyPositionManager();
    error ManagerAlreadySet();
    error SharesNonTransferable();

    struct Epoch {
        uint40 depositStart;
        uint40 depositEnd;
        uint40 start;
        uint40 end;
        uint40 settlementDeadline;
        uint128 depositedCapital;
        uint128 lockedCoverage;
        uint128 premium;
        int128 realizedPnl;
        uint64 openPositions;
        bool closed;
    }
    IERC20 public immutable usdc;
    address public positionManager;
    uint256 public nextEpochId = 1;
    mapping(uint256 => Epoch) public epochs;
    mapping(uint256 => uint256) public totalShares;
    event EpochCreated(
        uint256 indexed epochId,
        uint40 depositStart,
        uint40 depositEnd,
        uint40 start,
        uint40 end,
        uint40 settlementDeadline
    );
    event CoverageLocked(uint256 indexed epochId, uint256 indexed positionId, uint256 amount);
    event CoverageReleased(
        uint256 indexed epochId, uint256 indexed positionId, uint256 amount, int256 realizedPnl
    );
    event PremiumRecorded(uint256 indexed epochId, uint256 indexed positionId, uint256 amount);

    constructor(IERC20 usdc_, address admin) ERC1155("") {
        usdc = usdc_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EPOCH_ADMIN_ROLE, admin);
    }
    modifier onlyManager() {
        if (msg.sender != positionManager) revert OnlyPositionManager();
        _;
    }

    function setPositionManager(address manager) external onlyRole(EPOCH_ADMIN_ROLE) {
        if (positionManager != address(0)) revert ManagerAlreadySet();
        if (manager == address(0)) revert OnlyPositionManager();
        positionManager = manager;
    }

    function createEpoch(
        uint40 depositStart,
        uint40 depositEnd,
        uint40 start,
        uint40 end,
        uint40 settlementDeadline
    ) external onlyRole(EPOCH_ADMIN_ROLE) returns (uint256 id) {
        if (!(depositStart < depositEnd && depositEnd <= start && start < end && end <= settlementDeadline)) {
            revert InvalidEpoch();
        }
        id = nextEpochId++;
        epochs[id] = Epoch(depositStart, depositEnd, start, end, settlementDeadline, 0, 0, 0, 0, 0, false);
        emit EpochCreated(id, depositStart, depositEnd, start, end, settlementDeadline);
    }

    function deposit(uint256 id, uint256 assets, address receiver)
        external
        nonReentrant
        returns (uint256 shares)
    {
        Epoch storage e = epochs[id];
        if (block.timestamp < e.depositStart || block.timestamp >= e.depositEnd || e.closed) {
            revert EpochNotOpen();
        }
        shares = totalShares[id] == 0 ? assets : Math.mulDiv(assets, totalShares[id], e.depositedCapital);
        if (shares == 0) revert InvalidEpoch();
        e.depositedCapital += uint128(assets);
        totalShares[id] += shares;
        usdc.safeTransferFrom(msg.sender, address(this), assets);
        _mint(receiver, id, shares, "");
    }

    function availableCoverage(uint256 id) public view returns (uint256) {
        Epoch storage e = epochs[id];
        uint256 nav = e.realizedPnl < 0
            ? uint256(int256(uint256(e.depositedCapital) + e.premium) + e.realizedPnl)
            : uint256(e.depositedCapital) + e.premium + uint256(int256(e.realizedPnl));
        return nav > e.lockedCoverage ? nav - e.lockedCoverage : 0;
    }

    function lockCoverage(uint256 id, uint256 positionId, uint256 amount, uint40 maturityWithGrace)
        external
        onlyManager
    {
        Epoch storage e = epochs[id];
        if (block.timestamp < e.start || block.timestamp >= e.end || maturityWithGrace > e.settlementDeadline)
        {
            revert InvalidEpoch();
        }
        if (amount > availableCoverage(id)) revert CoverageUnavailable();
        e.lockedCoverage += uint128(amount);
        e.openPositions++;
        emit CoverageLocked(id, positionId, amount);
    }

    /// @notice Records premium already transferred into this vault by the manager.
    function recordPremium(uint256 id, uint256 positionId, uint256 amount) external onlyManager {
        Epoch storage e = epochs[id];
        if (e.closed || amount > type(uint128).max) revert InvalidEpoch();
        e.premium += uint128(amount);
        emit PremiumRecorded(id, positionId, amount);
    }

    /// @notice Sends previously locked capital to the manager for an atomic buyback.
    function drawCoverage(uint256 id, uint256 amount, address receiver) external onlyManager {
        if (amount > epochs[id].lockedCoverage) revert CoverageUnavailable();
        usdc.safeTransfer(receiver, amount);
    }

    function settleCoverage(
        uint256 id,
        uint256 positionId,
        uint256 locked,
        uint256 juniorSpent,
        int256 pnl,
        uint256 premium
    ) external onlyManager {
        Epoch storage e = epochs[id];
        if (locked > e.lockedCoverage || e.openPositions == 0 || juniorSpent > locked) {
            revert CoverageUnavailable();
        }
        e.lockedCoverage -= uint128(locked);
        e.openPositions--;
        if (premium != 0) revert InvalidEpoch();
        e.realizedPnl += int128(pnl) - int128(int256(juniorSpent));
        emit CoverageReleased(id, positionId, locked, pnl - int256(juniorSpent));
    }

    function closeEpoch(uint256 id) external {
        Epoch storage e = epochs[id];
        if (block.timestamp < e.end || e.openPositions != 0) revert InvalidEpoch();
        e.closed = true;
    }

    function redeem(uint256 id, uint256 shares, address receiver)
        external
        nonReentrant
        returns (uint256 assets)
    {
        Epoch storage e = epochs[id];
        if (!e.closed || e.openPositions != 0) revert InvalidEpoch();
        uint256 nav = e.realizedPnl < 0
            ? uint256(int256(uint256(e.depositedCapital) + e.premium) + e.realizedPnl)
            : uint256(e.depositedCapital) + e.premium + uint256(int256(e.realizedPnl));
        assets = Math.mulDiv(shares, nav, totalShares[id]);
        totalShares[id] -= shares;
        e.depositedCapital = uint128(nav - assets);
        _burn(msg.sender, id, shares);
        usdc.safeTransfer(receiver, assets);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override
    {
        if (from != address(0) && to != address(0)) revert SharesNonTransferable();
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
