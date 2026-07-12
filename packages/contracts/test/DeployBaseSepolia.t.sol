// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { Test } from "forge-std/Test.sol";
import { DeployBaseSepolia } from "../script/DeployBaseSepolia.s.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";

contract DeployBaseSepoliaTest is Test {
    address constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function testDeploymentWiresAndHandsOffGovernance() public {
        vm.chainId(84532);
        MockERC20 usdcTemplate = new MockERC20("USD Coin", "USDC", 6);
        vm.etch(BASE_SEPOLIA_USDC, address(usdcTemplate).code);
        address admin = makeAddr("testnetAdmin");
        address proposer = makeAddr("proposer");
        address guardian = makeAddr("guardian");
        vm.setEnv("TESTNET_ADMIN", vm.toString(admin));
        vm.setEnv("TESTNET_TIMELOCK_PROPOSER", vm.toString(proposer));
        vm.setEnv("TESTNET_PAUSE_GUARDIAN", vm.toString(guardian));
        vm.setEnv("WRITE_DEPLOYMENT_MANIFEST", "false");

        DeployBaseSepolia.Deployment memory deployment = new DeployBaseSepolia().run();

        assertEq(address(deployment.seniorVault.positionManager()), address(deployment.positionManager));
        assertTrue(
            deployment.riskManager
                .hasRole(deployment.riskManager.RISK_ADMIN_ROLE(), address(deployment.timelock))
        );
        assertFalse(deployment.riskManager.hasRole(deployment.riskManager.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(deployment.validator.validate(address(deployment.creatorToken), 4));
    }
}
