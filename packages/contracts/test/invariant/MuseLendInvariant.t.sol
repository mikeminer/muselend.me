// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;
import { Test } from "forge-std/Test.sol";
import { StdInvariant } from "forge-std/StdInvariant.sol";
import { InterestRateModel } from "../../src/InterestRateModel.sol";
import { MuseLendUSDCVault } from "../../src/MuseLendUSDCVault.sol";
import { MuseLendHedgeEpochVault } from "../../src/MuseLendHedgeEpochVault.sol";
import { MuseLendPositionReceipt } from "../../src/MuseLendPositionReceipt.sol";
import { MuseLendRiskManager } from "../../src/MuseLendRiskManager.sol";
import { CreatorTokenValidator } from "../../src/CreatorTokenValidator.sol";
import { MuseLendPositionManager } from "../../src/MuseLendPositionManager.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import { MockZoraCreatorToken } from "../../src/mocks/MockZoraCreatorToken.sol";
import { MockSwapAdapter } from "../../src/mocks/MockSwapAdapter.sol";
import { ProtocolHandler } from "./ProtocolHandler.sol";

contract MuseLendInvariant is StdInvariant, Test {
    MockERC20 usdc;
    MockZoraCreatorToken creator;
    MuseLendUSDCVault senior;
    MuseLendHedgeEpochVault junior;
    MuseLendPositionManager manager;
    ProtocolHandler handler;

    function setUp() public {
        address admin = address(this);
        usdc = new MockERC20("USDC", "USDC", 6);
        creator = new MockZoraCreatorToken(address(usdc), makeAddr("zoraHook"));
        MockSwapAdapter adapter = new MockSwapAdapter(10e6);
        InterestRateModel rate = new InterestRateModel(
            InterestRateModel.Config(
                uint96(2e25), uint96(1e26), uint96(68e25), uint96(8e26), uint96(8e26), 1000
            )
        );
        senior = new MuseLendUSDCVault(usdc, admin, rate, makeAddr("treasury"));
        junior = new MuseLendHedgeEpochVault(usdc, admin);
        MuseLendPositionReceipt receipt = new MuseLendPositionReceipt(admin);
        MuseLendRiskManager risk =
            new MuseLendRiskManager(admin, admin, admin, false, 1_000_000e6, 500_000e6, 50);
        CreatorTokenValidator validator = new CreatorTokenValidator(admin);
        manager = new MuseLendPositionManager(
            usdc, senior, junior, receipt, risk, validator, admin, admin, address(adapter), makeAddr("fees")
        );
        senior.setPositionManager(address(manager));
        junior.setPositionManager(address(manager));
        receipt.setPositionManager(address(manager));
        validator.setCanonical(address(creator), 4);
        risk.setTokenConfig(
            address(creator),
            MuseLendRiskManager.TokenConfig(
                true,
                4,
                1,
                6000,
                9000,
                15000,
                1000,
                1e6,
                type(uint128).max,
                type(uint128).max,
                type(uint128).max
            )
        );
        risk.setTerm(address(creator), 7 days, 250, true);
        usdc.mint(address(this), 2_000_000e6);
        usdc.approve(address(senior), type(uint256).max);
        senior.deposit(1_000_000e6, address(this));
        junior.createEpoch(
            uint40(block.timestamp - 1),
            uint40(block.timestamp + 10),
            uint40(block.timestamp + 10),
            uint40(block.timestamp + 10 days),
            uint40(block.timestamp + 14 days)
        );
        address underwriter = makeAddr("underwriter");
        usdc.mint(underwriter, 1_000_000e6);
        vm.startPrank(underwriter);
        usdc.approve(address(junior), type(uint256).max);
        junior.deposit(1, 1_000_000e6, underwriter);
        vm.stopPrank();
        vm.warp(block.timestamp + 11);
        usdc.mint(address(adapter), 10_000_000e6);
        handler = new ProtocolHandler(manager, creator, address(adapter), address(usdc));
        targetContract(address(handler));
    }

    function invariantEveryReservedDollarRemainsIsolated() public view {
        assertEq(usdc.balanceOf(address(manager)), manager.totalReservedUsdc());
    }

    function invariantSeniorPrincipalNeverExceedsSixtyPercentOfRealizedReserves() public view {
        assertLe(senior.totalPrincipalOutstanding(), manager.totalReservedUsdc() * 6000 / 10_000);
    }

    function invariantJuniorLocksMatchConfiguredCoverage() public view {
        (,,,,,, uint128 locked,,,,) = junior.epochs(1);
        assertEq(locked, handler.expectedJuniorCoverage());
    }
}
