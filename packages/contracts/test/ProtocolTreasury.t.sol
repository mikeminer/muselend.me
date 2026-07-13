// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.35;
import { Test } from "forge-std/Test.sol";
import { ProtocolTreasury } from "../src/ProtocolTreasury.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";

contract ProtocolTreasuryTest is Test {
    MockERC20 usdc;
    ProtocolTreasury treasury;
    address manager = makeAddr("feeManager");
    address receiver = makeAddr("receiver");

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 6);
        treasury = new ProtocolTreasury(usdc, address(this), manager);
        usdc.mint(address(treasury), 100e6);
    }

    function testOnlyFeeManagerWithdrawsExplicitFees() public {
        vm.prank(manager);
        treasury.withdrawFees(receiver, 40e6);
        assertEq(usdc.balanceOf(receiver), 40e6);
        assertEq(usdc.balanceOf(address(treasury)), 60e6);
    }

    function testUnprivilegedCannotWithdraw() public {
        vm.expectRevert();
        treasury.withdrawFees(receiver, 1);
    }
}
