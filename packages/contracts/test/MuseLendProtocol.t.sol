// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;
import { Test } from "forge-std/Test.sol";
import { InterestRateModel } from "../src/InterestRateModel.sol";
import { MuseLendUSDCVault } from "../src/MuseLendUSDCVault.sol";
import { MuseLendHedgeEpochVault } from "../src/MuseLendHedgeEpochVault.sol";
import { MuseLendPositionReceipt } from "../src/MuseLendPositionReceipt.sol";
import { MuseLendRiskManager } from "../src/MuseLendRiskManager.sol";
import { CreatorTokenValidator } from "../src/CreatorTokenValidator.sol";
import { MuseLendPositionManager } from "../src/MuseLendPositionManager.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";
import { MockZoraCreatorToken } from "../src/mocks/MockZoraCreatorToken.sol";
import { MockSwapAdapter } from "../src/mocks/MockSwapAdapter.sol";
import { ISwapAdapter } from "../src/interfaces/ISwapAdapter.sol";

contract MuseLendProtocolTest is Test {
    MockERC20 usdc;
    MockZoraCreatorToken creator;
    MockSwapAdapter adapter;
    InterestRateModel rate;
    MuseLendUSDCVault senior;
    MuseLendHedgeEpochVault junior;
    MuseLendPositionReceipt receipt;
    MuseLendRiskManager risk;
    CreatorTokenValidator validator;
    MuseLendPositionManager manager;
    address admin = makeAddr("admin");
    address borrower = makeAddr("borrower");
    address lender = makeAddr("lender");
    address underwriter = makeAddr("underwriter");
    address treasury = makeAddr("treasury");
    ISwapAdapter.Route route;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        creator = new MockZoraCreatorToken(address(usdc), makeAddr("zoraHook"));
        adapter = new MockSwapAdapter(10e6);
        rate = new InterestRateModel(
            InterestRateModel.Config(
                uint96(2e25), uint96(1e26), uint96(68e25), uint96(8e26), uint96(8e26), 1000
            )
        );
        senior = new MuseLendUSDCVault(usdc, admin, rate, treasury);
        junior = new MuseLendHedgeEpochVault(usdc, admin);
        receipt = new MuseLendPositionReceipt(admin);
        risk = new MuseLendRiskManager(admin, admin, admin, false, 1_000_000e6, 500_000e6, 50);
        validator = new CreatorTokenValidator(admin);
        manager = new MuseLendPositionManager(
            usdc, senior, junior, receipt, risk, validator, admin, admin, address(adapter), treasury
        );
        vm.startPrank(admin);
        senior.setPositionManager(address(manager));
        junior.setPositionManager(address(manager));
        receipt.setPositionManager(address(manager));
        validator.setCanonical(address(creator), 4);
        risk.setTokenConfig(
            address(creator),
            MuseLendRiskManager.TokenConfig(
                true, 4, 1, 6000, 9000, 15000, 1000, 100e6, 100_000e6, 1_000_000e6, 100_000e6
            )
        );
        risk.setTerm(address(creator), 7 days, 250, true);
        vm.stopPrank();
        usdc.mint(lender, 100_000e6);
        vm.startPrank(lender);
        usdc.approve(address(senior), type(uint256).max);
        senior.deposit(100_000e6, lender);
        vm.stopPrank();
        usdc.mint(underwriter, 100_000e6);
        vm.prank(admin);
        junior.createEpoch(
            uint40(block.timestamp - 1),
            uint40(block.timestamp + 10),
            uint40(block.timestamp + 10),
            uint40(block.timestamp + 10 days),
            uint40(block.timestamp + 14 days)
        );
        vm.startPrank(underwriter);
        usdc.approve(address(junior), type(uint256).max);
        junior.deposit(1, 100_000e6, underwriter);
        vm.stopPrank();
        vm.warp(block.timestamp + 11);
        creator.mint(borrower, 1_000e18);
        usdc.mint(address(adapter), 1_000_000e6);
        route = ISwapAdapter.Route(
            address(creator), address(usdc), bytes32(uint256(1)), 3000, 60, address(0), 1
        );
    }

    function open() internal returns (uint256) {
        vm.startPrank(borrower);
        creator.approve(address(manager), type(uint256).max);
        uint256 id = manager.openPosition(
            MuseLendPositionManager.OpenParams(
                address(creator),
                address(adapter),
                100e18,
                999e6,
                600e6,
                7 days,
                1,
                block.timestamp + 1 hours,
                route
            )
        );
        vm.stopPrank();
        return id;
    }

    function openExpectCoverageViolation() internal {
        vm.startPrank(borrower);
        creator.approve(address(manager), type(uint256).max);
        vm.expectRevert(MuseLendPositionManager.CoverageViolation.selector);
        manager.openPosition(
            MuseLendPositionManager.OpenParams(
                address(creator),
                address(adapter),
                100e18,
                999e6,
                600e6,
                7 days,
                1,
                block.timestamp + 1 hours,
                route
            )
        );
        vm.stopPrank();
    }

    function testOpenUsesRealizedSaleBeforeLoan() public {
        uint256 id = open();
        (
            address owner,,,
            uint128 amount,
            uint128 proceeds,
            uint128 principal,,,
            uint128 juniorCoverage,
            uint128 premium,
            uint128 originationFee,,,,,,
            MuseLendPositionManager.State state
        ) = manager.positions(id);
        assertEq(owner, borrower);
        assertEq(amount, 100e18);
        assertEq(proceeds, 1000e6);
        assertEq(principal, 600e6);
        assertEq(juniorCoverage, 500e6);
        assertEq(premium, 12_500_000);
        assertEq(originationFee, 3_000_000);
        assertEq(usdc.balanceOf(borrower), 584_500_000);
        assertEq(usdc.balanceOf(treasury), originationFee);
        assertEq(uint256(state), uint256(MuseLendPositionManager.State.Open));
        assertEq(manager.totalReservedUsdc(), 1000e6);
        assertEq(receipt.ownerOf(id), borrower);
        assertEq(senior.totalPrincipalOutstanding(), 600e6);
        assertEq(junior.totalLockedCoverage(), juniorCoverage);
    }

    function testGlobalSeniorDebtCapRejectsOrigination() public {
        vm.prank(admin);
        risk.setGlobalCaps(599e6, 500_000e6);
        openExpectCoverageViolation();
    }

    function testGlobalJuniorCoverageCapRejectsOrigination() public {
        vm.prank(admin);
        risk.setGlobalCaps(1_000_000e6, 499e6);
        openExpectCoverageViolation();
    }

    function testFullCloseUsesJuniorOnlyAboveSaleReserve() public {
        uint256 id = open();
        adapter.setPrice(12e6);
        usdc.mint(borrower, 100e6);
        vm.startPrank(borrower);
        usdc.approve(address(manager), type(uint256).max);
        uint256 cost = manager.closeFull(id, 0, block.timestamp + 1 hours, route);
        vm.stopPrank();
        assertEq(cost, 1200e6);
        assertEq(creator.balanceOf(borrower), 1000e18);
        assertEq(manager.totalReservedUsdc(), 0);
        vm.expectRevert();
        receipt.ownerOf(id);
        (,,,,,, uint128 locked,, int128 pnl,,) = junior.epochs(1);
        assertEq(locked, 0);
        assertEq(pnl, -int128(200e6));
    }

    function testCappedSettlementReturnsPartialQuantity() public {
        uint256 id = open();
        adapter.setPrice(30e6);
        usdc.mint(borrower, 100e6);
        vm.startPrank(borrower);
        usdc.approve(address(manager), type(uint256).max);
        uint256 out = manager.closeCapped(id, 49e18, block.timestamp + 1 hours, route);
        vm.stopPrank();
        assertEq(out, 50e18);
        assertEq(creator.balanceOf(borrower), 950e18);
    }

    function testPermissionlessDefaultPaysSeniorFirst() public {
        uint256 id = open();
        vm.warp(block.timestamp + 10 days + 1);
        uint256 before = usdc.balanceOf(address(senior));
        manager.settleExpiredPosition(id);
        assertGt(usdc.balanceOf(address(senior)), before);
        assertEq(manager.totalReservedUsdc(), 0);
        assertGt(usdc.balanceOf(treasury), 0);
        assertEq(usdc.balanceOf(treasury), 3_000_000 + senior.protocolFeesPaid());
        (,,,,,,,,,,,,,,,, MuseLendPositionManager.State state) = manager.positions(id);
        assertEq(uint256(state), uint256(MuseLendPositionManager.State.Defaulted));
    }
}
