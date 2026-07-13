// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.35;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IAllowanceTransfer } from "../../src/interfaces/IUniversalRouter.sol";

contract MockPermit2 is IAllowanceTransfer {
    using SafeERC20 for IERC20;

    mapping(address owner => mapping(address token => mapping(address spender => uint160 amount))) public
        allowance;

    function approve(address token, address spender, uint160 amount, uint48) external {
        allowance[msg.sender][token][spender] = amount;
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        uint160 available = allowance[from][token][msg.sender];
        require(available >= amount, "PERMIT2_ALLOWANCE");
        allowance[from][token][msg.sender] = available - amount;
        IERC20(token).safeTransferFrom(from, to, amount);
    }
}
