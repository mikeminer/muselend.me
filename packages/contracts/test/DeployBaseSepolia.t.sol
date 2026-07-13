// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { Test } from "forge-std/Test.sol";
import { DeployBaseSepolia } from "../script/DeployBaseSepolia.s.sol";
import { MuseLendPositionManager } from "../src/MuseLendPositionManager.sol";
import { ISwapAdapter } from "../src/interfaces/ISwapAdapter.sol";
import { MockMirrorFactory, MockOfficialMirror } from "./helpers/MirrorMocks.sol";

contract DeployBaseSepoliaTest is Test {
    function testDeploymentWiresAndHandsOffGovernance() public {
        vm.chainId(84532);
        address admin = makeAddr("testnetAdmin");
        address proposer = makeAddr("proposer");
        address guardian = makeAddr("guardian");
        MockMirrorFactory factory = new MockMirrorFactory();
        address sourceToken = makeAddr("sourceToken");
        MockOfficialMirror mirror =
            new MockOfficialMirror(address(factory), sourceToken, makeAddr("currency"), makeAddr("hook"));
        factory.setMirror(sourceToken, address(mirror));
        vm.setEnv("TESTNET_ADMIN", vm.toString(admin));
        vm.setEnv("TESTNET_TIMELOCK_PROPOSER", vm.toString(proposer));
        vm.setEnv("TESTNET_PAUSE_GUARDIAN", vm.toString(guardian));
        vm.setEnv("CREATOR_MIRROR_FACTORY_ADDRESS", vm.toString(address(factory)));
        vm.setEnv("WRITE_DEPLOYMENT_MANIFEST", "false");

        DeployBaseSepolia.Deployment memory deployment = new DeployBaseSepolia().run();

        assertEq(address(deployment.seniorVault.positionManager()), address(deployment.positionManager));
        assertTrue(
            deployment.riskManager
                .hasRole(deployment.riskManager.RISK_ADMIN_ROLE(), address(deployment.timelock))
        );
        assertFalse(deployment.riskManager.hasRole(deployment.riskManager.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(deployment.validator.validate(address(deployment.creatorToken), 4));
        assertTrue(deployment.validator.validate(address(mirror), 4));
        assertTrue(deployment.riskManager.getTokenConfig(address(mirror)).enabled);
        assertEq(deployment.riskManager.termPremium(address(mirror), 30 days), 250);
        assertEq(deployment.usdc.balanceOf(address(deployment.adapter)), 500_000e6);
        assertEq(deployment.hedgeVault.availableCoverage(deployment.seedEpochId), 500_000e6);

        address borrower = makeAddr("borrower");
        uint256 amount = 10_000_000e18;
        mirror.mint(borrower, amount);
        vm.warp(block.timestamp + 6 minutes);
        vm.startPrank(borrower);
        mirror.approve(address(deployment.positionManager), amount);
        uint256 positionId = deployment.positionManager
            .openPosition(
                MuseLendPositionManager.OpenParams({
                    creatorToken: address(mirror),
                    adapter: address(deployment.adapter),
                    amount: amount,
                    minUsdcOut: 9_900_000,
                    principal: 5_000_000,
                    term: 30 days,
                    epochId: uint32(deployment.seedEpochId),
                    deadline: block.timestamp + 5 minutes,
                    route: ISwapAdapter.Route({
                        creatorToken: address(mirror),
                        usdc: address(deployment.usdc),
                        poolId: bytes32(0),
                        fee: 0,
                        tickSpacing: 0,
                        hook: address(0),
                        minHopPriceX36: 1
                    })
                })
            );
        vm.stopPrank();

        assertEq(positionId, 1);
        assertEq(deployment.receipt.ownerOf(positionId), borrower);
        assertEq(deployment.positionManager.tokenExposure(address(mirror)), 10_000_000);
        assertGt(deployment.usdc.balanceOf(borrower), 0);
    }
}
