// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Holds only explicitly transferred protocol fees. It is never approved to pull reserves.
contract ProtocolTreasury is AccessControl {
    using SafeERC20 for IERC20;
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    IERC20 public immutable usdc;
    event FeesWithdrawn(address indexed receiver, uint256 amount);
    error InvalidReceiver();

    constructor(IERC20 usdc_, address admin, address feeManager) {
        if (address(usdc_) == address(0) || admin == address(0) || feeManager == address(0)) {
            revert InvalidReceiver();
        }
        usdc = usdc_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(FEE_MANAGER_ROLE, feeManager);
    }

    function withdrawFees(address receiver, uint256 amount) external onlyRole(FEE_MANAGER_ROLE) {
        if (receiver == address(0)) revert InvalidReceiver();
        usdc.safeTransfer(receiver, amount);
        emit FeesWithdrawn(receiver, amount);
    }
}
