// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { Test } from "forge-std/Test.sol";
import { MuseLendTestUSDC } from "../src/mocks/MuseLendTestUSDC.sol";

contract MuseLendTestUSDCTest is Test {
    function testInitialLiquidityAndOneTimeFaucet() public {
        address holder = makeAddr("holder");
        address user = makeAddr("user");
        MuseLendTestUSDC token = new MuseLendTestUSDC(holder);

        assertEq(token.decimals(), 6);
        assertEq(token.balanceOf(holder), token.INITIAL_LIQUIDITY());

        vm.prank(user);
        assertEq(token.faucet(), 10_000e6);
        assertEq(token.balanceOf(user), 10_000e6);
        assertTrue(token.hasClaimedFaucet(user));

        vm.prank(user);
        vm.expectRevert(MuseLendTestUSDC.FaucetAlreadyClaimed.selector);
        token.faucet();
    }
}
