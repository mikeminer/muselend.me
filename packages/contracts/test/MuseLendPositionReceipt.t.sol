// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.35;
import { Test } from "forge-std/Test.sol";
import { MuseLendPositionReceipt } from "../src/MuseLendPositionReceipt.sol";

contract MuseLendPositionReceiptTest is Test {
    MuseLendPositionReceipt receipt;
    address manager = makeAddr("manager");
    address initializer = makeAddr("initializer");
    address alice = makeAddr("alice");

    function setUp() public {
        receipt = new MuseLendPositionReceipt(initializer);
        vm.prank(initializer);
        receipt.setPositionManager(manager);
        vm.prank(manager);
        receipt.mint(alice, 1);
    }

    function testReceiptCannotTransfer() public {
        vm.prank(alice);
        vm.expectRevert(MuseLendPositionReceipt.ReceiptNonTransferable.selector);
        receipt.transferFrom(alice, address(2), 1);
    }

    function testOnlyManagerCanBurn() public {
        vm.prank(alice);
        vm.expectRevert(MuseLendPositionReceipt.OnlyPositionManager.selector);
        receipt.burn(1);
        vm.prank(manager);
        receipt.burn(1);
        vm.expectRevert();
        receipt.ownerOf(1);
    }
}
