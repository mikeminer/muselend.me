// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import { Script } from "forge-std/Script.sol";
import { BaseCreatorTokenMirrorFactory } from "../src/BaseCreatorTokenMirrorFactory.sol";

/// @notice Deploys only the isolated Base-to-Base-Sepolia Creator Coin mirror factory.
contract DeployBaseSepoliaMirror is Script {
    address internal constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address internal constant BASE_SEPOLIA_ZORA_V4_HOOK = 0xe0eC17Ab9f7ce52cC60DFB64E0A0A705d02Bd040;

    error InvalidAttester();
    error PostDeploymentInvariant();
    error WrongChain();

    function run() external returns (BaseCreatorTokenMirrorFactory factory) {
        if (block.chainid != 84532) revert WrongChain();
        address admin = vm.envAddress("TESTNET_ADMIN");
        address attester = vm.envAddress("TESTNET_CLAIM_ATTESTER");
        if (attester == address(0)) revert InvalidAttester();

        vm.startBroadcast(admin);
        factory = new BaseCreatorTokenMirrorFactory(attester, BASE_SEPOLIA_USDC, BASE_SEPOLIA_ZORA_V4_HOOK);
        vm.stopBroadcast();

        if (
            factory.attester() != attester || factory.currency() != BASE_SEPOLIA_USDC
                || factory.hook() != BASE_SEPOLIA_ZORA_V4_HOOK || factory.SOURCE_CHAIN_ID() != 8453
                || factory.DESTINATION_CHAIN_ID() != 84532
        ) revert PostDeploymentInvariant();

        if (vm.envOr("WRITE_DEPLOYMENT_MANIFEST", true)) {
            string memory object = "baseSepoliaMirror";
            vm.serializeUint(object, "chainId", block.chainid);
            vm.serializeUint(object, "deploymentBlock", block.number);
            vm.serializeAddress(object, "attester", attester);
            string memory json = vm.serializeAddress(object, "mirrorFactory", address(factory));
            vm.writeJson(json, "deployments/base-sepolia-mirror.json");
        }
    }
}
