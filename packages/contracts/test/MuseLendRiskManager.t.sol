// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;
import { Test } from "forge-std/Test.sol";
import { MuseLendRiskManager } from "../src/MuseLendRiskManager.sol";

contract MuseLendRiskManagerTest is Test {
    MuseLendRiskManager risk;
    address admin = makeAddr("admin");
    address guardian = makeAddr("guardian");
    address token = makeAddr("token");

    function setUp() public {
        risk = new MuseLendRiskManager(admin, admin, guardian, false, 1_000_000e6, 500_000e6, 50);
    }

    function validConfig() internal pure returns (MuseLendRiskManager.TokenConfig memory) {
        return MuseLendRiskManager.TokenConfig(
            true, 4, 2, 6000, 9000, 15000, 1000, 100e6, 10_000e6, 100_000e6, 20_000e6
        );
    }

    function testConfigurationAndTerm() public {
        vm.startPrank(admin);
        risk.setTokenConfig(token, validConfig());
        risk.setTerm(token, 30 days, 250, true);
        vm.stopPrank();
        assertEq(risk.termPremium(token, 30 days), 250);
        (bool enabled,,,,,,,,,,) = risk.tokenConfig(token);
        assertTrue(enabled);
    }

    function testGuardianCannotUnpause() public {
        vm.prank(guardian);
        risk.pauseRisk();
        assertTrue(risk.openingsPaused());
        vm.prank(guardian);
        vm.expectRevert();
        risk.unpauseRisk();
        vm.prank(admin);
        risk.unpauseRisk();
        assertFalse(risk.openingsPaused());
    }

    function testRejectsAdvanceRateAboveHardCap() public {
        MuseLendRiskManager.TokenConfig memory c = validConfig();
        c.advanceRateBps = 6001;
        vm.prank(admin);
        vm.expectRevert();
        risk.setTokenConfig(token, c);
    }

    function testGlobalCapsAreBoundedAndRoleProtected() public {
        vm.prank(admin);
        risk.setGlobalCaps(1_000_000e6, 500_000e6);
        assertEq(risk.globalSeniorDebtCap(), 1_000_000e6);
        assertEq(risk.globalJuniorCoverageCap(), 500_000e6);

        vm.expectRevert();
        risk.setGlobalCaps(1, 1);

        vm.prank(admin);
        vm.expectRevert(MuseLendRiskManager.InvalidRiskConfiguration.selector);
        risk.setGlobalCaps(0, 1);
    }

    function testOriginationFeeHasHardCap() public {
        vm.prank(admin);
        risk.setOriginationFee(200);
        assertEq(risk.originationFeeBps(), 200);

        vm.prank(admin);
        vm.expectRevert(MuseLendRiskManager.InvalidRiskConfiguration.selector);
        risk.setOriginationFee(201);
    }
}
