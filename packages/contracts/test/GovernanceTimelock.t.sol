// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { Test } from "forge-std/Test.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { MuseLendRiskManager } from "../src/MuseLendRiskManager.sol";

contract GovernanceTimelockTest is Test {
    uint256 internal constant DELAY = 1 days;
    address internal proposer = makeAddr("proposer");
    address internal guardian = makeAddr("guardian");
    TimelockController internal timelock;
    MuseLendRiskManager internal risk;

    function setUp() public {
        address[] memory proposers = new address[](1);
        proposers[0] = proposer;
        address[] memory executors = new address[](1);
        executors[0] = address(0);
        timelock = new TimelockController(DELAY, proposers, executors, address(0));
        risk = new MuseLendRiskManager(
            address(this), address(timelock), guardian, false, 1_000_000e6, 500_000e6, 50
        );
    }

    function testRiskChangeCannotExecuteBeforeDelay() public {
        bytes memory payload = abi.encodeCall(MuseLendRiskManager.setGlobalCaps, (2_000_000e6, 750_000e6));
        bytes32 salt = keccak256("global-caps-v2");

        vm.prank(proposer);
        timelock.schedule(address(risk), 0, payload, bytes32(0), salt, DELAY);

        vm.expectRevert();
        timelock.execute(address(risk), 0, payload, bytes32(0), salt);

        vm.warp(block.timestamp + DELAY);
        timelock.execute(address(risk), 0, payload, bytes32(0), salt);

        assertEq(risk.globalSeniorDebtCap(), 2_000_000e6);
        assertEq(risk.globalJuniorCoverageCap(), 750_000e6);
    }

    function testGuardianPauseRemainsImmediate() public {
        vm.prank(guardian);
        risk.pauseRisk();
        assertTrue(risk.openingsPaused());
        assertTrue(risk.depositsPaused());
    }
}
