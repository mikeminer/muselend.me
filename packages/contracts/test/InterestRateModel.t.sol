// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.35;
import { Test } from "forge-std/Test.sol";
import { InterestRateModel } from "../src/InterestRateModel.sol";

contract InterestRateModelTest is Test {
    uint256 constant RAY = 1e27;
    InterestRateModel model;

    function setUp() public {
        model = new InterestRateModel(
            InterestRateModel.Config({
                baseRateRay: uint96(2e25),
                preKinkSlopeRay: uint96(1e26),
                postKinkSlopeRay: uint96(68e25),
                kinkRay: uint96(8e26),
                maxBorrowRateRay: uint96(8e26),
                reserveFactorBps: 1000
            })
        );
    }

    function testRatesAtCurvePoints() public view {
        assertEq(model.borrowRate(0), 2e25);
        assertEq(model.borrowRate(8e26), 12e25);
        assertEq(model.borrowRate(RAY), 8e26);
    }

    function testUtilization() public view {
        assertEq(model.utilization(0, 0), 0);
        assertEq(model.utilization(20, 80), 8e26);
    }

    function testFuzzRateNeverExceedsMaximum(uint256 u) public view {
        u = bound(u, 0, type(uint256).max);
        assertLe(model.borrowRate(u), 8e26);
    }
}
