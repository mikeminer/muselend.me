// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.35;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title MuseLend kinked interest-rate model
/// @notice Returns annualized rates in RAY precision and always rounds rate components up.
contract InterestRateModel {
    uint256 public constant RAY = 1e27;

    error InvalidConfiguration();

    struct Config {
        uint96 baseRateRay;
        uint96 preKinkSlopeRay;
        uint96 postKinkSlopeRay;
        uint96 kinkRay;
        uint96 maxBorrowRateRay;
        uint16 reserveFactorBps;
    }

    uint96 public immutable baseRateRay;
    uint96 public immutable preKinkSlopeRay;
    uint96 public immutable postKinkSlopeRay;
    uint96 public immutable kinkRay;
    uint96 public immutable maxBorrowRateRay;
    uint16 public immutable reserveFactorBps;

    constructor(Config memory config_) {
        if (
            config_.kinkRay == 0 || config_.kinkRay >= RAY || config_.maxBorrowRateRay > RAY
                || config_.reserveFactorBps > 5000
        ) revert InvalidConfiguration();
        baseRateRay = config_.baseRateRay;
        preKinkSlopeRay = config_.preKinkSlopeRay;
        postKinkSlopeRay = config_.postKinkSlopeRay;
        kinkRay = config_.kinkRay;
        maxBorrowRateRay = config_.maxBorrowRateRay;
        reserveFactorBps = config_.reserveFactorBps;
    }

    /// @notice Utilization as borrows divided by cash plus borrows.
    function utilization(uint256 cash, uint256 borrows) public pure returns (uint256) {
        uint256 denominator = cash + borrows;
        return denominator == 0 ? 0 : Math.mulDiv(borrows, RAY, denominator);
    }

    /// @notice Annual borrow APR for a supplied utilization, capped by maxBorrowRateRay.
    function borrowRate(uint256 utilizationRay) public view returns (uint256) {
        if (utilizationRay > RAY) utilizationRay = RAY;
        uint256 rate;
        if (utilizationRay <= kinkRay) {
            rate = uint256(baseRateRay)
                + Math.mulDiv(preKinkSlopeRay, utilizationRay, kinkRay, Math.Rounding.Ceil);
        } else {
            rate = uint256(baseRateRay) + preKinkSlopeRay
                + Math.mulDiv(postKinkSlopeRay, utilizationRay - kinkRay, RAY - kinkRay, Math.Rounding.Ceil);
        }
        return Math.min(rate, maxBorrowRateRay);
    }

    /// @notice Current borrow rate using vault cash and outstanding borrows.
    function borrowRate(uint256 cash, uint256 borrows) external view returns (uint256) {
        return borrowRate(utilization(cash, borrows));
    }
}
