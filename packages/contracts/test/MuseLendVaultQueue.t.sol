// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;
import { Test } from "forge-std/Test.sol";
import { InterestRateModel } from "../src/InterestRateModel.sol";
import { MuseLendUSDCVault } from "../src/MuseLendUSDCVault.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";
import { MuseLendRiskManager } from "../src/MuseLendRiskManager.sol";

contract MuseLendVaultQueueTest is Test {
    MockERC20 usdc;
    MuseLendUSDCVault vault;
    address lender = makeAddr("lender");

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 6);
        InterestRateModel rate = new InterestRateModel(
            InterestRateModel.Config(
                uint96(2e25), uint96(1e26), uint96(68e25), uint96(8e26), uint96(8e26), 1000
            )
        );
        MuseLendRiskManager risk = new MuseLendRiskManager(
            address(this), address(this), address(this), false, 1_000_000e6, 500_000e6, 50
        );
        vault = new MuseLendUSDCVault(usdc, address(this), rate, risk, makeAddr("treasury"));
        vault.setPositionManager(address(this));
        usdc.mint(lender, 1000e6);
        vm.startPrank(lender);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(1000e6, lender);
        vm.stopPrank();
    }

    function testQueuedSharesClaimOneRequestWithoutLoop() public {
        uint256 shares = vault.balanceOf(lender) / 2;
        vm.prank(lender);
        uint256 id = vault.requestRedeem(shares, lender);
        uint256 before = usdc.balanceOf(lender);
        uint256 assets = vault.claimNextWithdrawal();
        assertEq(id, 1);
        assertEq(usdc.balanceOf(lender) - before, assets);
        assertEq(vault.nextRequestToProcess(), 2);
    }

    function testQueueWaitsWhenCashIsBorrowed() public {
        uint256 debtShares = vault.originate(1, address(0xB0B), 900e6);
        uint256 shares = vault.balanceOf(lender);
        vm.prank(lender);
        vault.requestRedeem(shares, lender);
        vm.expectRevert(MuseLendUSDCVault.InsufficientCash.selector);
        vault.claimNextWithdrawal();
        usdc.mint(address(vault), 900e6);
        vault.recordRepayment(1, debtShares, 900e6, 900e6);
        vault.claimNextWithdrawal();
        assertGt(usdc.balanceOf(lender), 0);
    }
}
