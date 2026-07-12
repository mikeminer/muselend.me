// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;
import { Script } from "forge-std/Script.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { InterestRateModel } from "../src/InterestRateModel.sol";
import { MuseLendRiskManager } from "../src/MuseLendRiskManager.sol";
import { CreatorTokenValidator } from "../src/CreatorTokenValidator.sol";
import { MuseLendUSDCVault } from "../src/MuseLendUSDCVault.sol";
import { MuseLendHedgeEpochVault } from "../src/MuseLendHedgeEpochVault.sol";
import { MuseLendPositionReceipt } from "../src/MuseLendPositionReceipt.sol";
import { MuseLendPositionManager } from "../src/MuseLendPositionManager.sol";
import { ProtocolTreasury } from "../src/ProtocolTreasury.sol";
import { MockZoraCreatorToken } from "../src/mocks/MockZoraCreatorToken.sol";
import { MockSwapAdapter } from "../src/mocks/MockSwapAdapter.sol";

contract DeployBaseSepolia is Script {
    address constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant BASE_SEPOLIA_ZORA_V4_HOOK = 0xe0eC17Ab9f7ce52cC60DFB64E0A0A705d02Bd040;
    error WrongChain();
    error InvalidCanonicalUsdc();
    error PostDeploymentInvariant();

    struct Deployment {
        MockZoraCreatorToken creatorToken;
        MockSwapAdapter adapter;
        InterestRateModel rateModel;
        MuseLendRiskManager riskManager;
        CreatorTokenValidator validator;
        MuseLendUSDCVault seniorVault;
        MuseLendHedgeEpochVault hedgeVault;
        MuseLendPositionReceipt receipt;
        MuseLendPositionManager positionManager;
        ProtocolTreasury treasury;
        TimelockController timelock;
    }

    function run() external returns (Deployment memory d) {
        if (block.chainid != 84532) revert WrongChain();
        if (BASE_SEPOLIA_USDC.code.length == 0 || IERC20Metadata(BASE_SEPOLIA_USDC).decimals() != 6) {
            revert InvalidCanonicalUsdc();
        }
        address admin = vm.envAddress("TESTNET_ADMIN");
        address timelockProposer = vm.envAddress("TESTNET_TIMELOCK_PROPOSER");
        address guardian = vm.envAddress("TESTNET_PAUSE_GUARDIAN");
        vm.startBroadcast(admin);
        address[] memory proposers = new address[](1);
        proposers[0] = timelockProposer;
        address[] memory executors = new address[](1);
        executors[0] = address(0);
        d.timelock = new TimelockController(1 days, proposers, executors, address(0));
        d.creatorToken = new MockZoraCreatorToken(BASE_SEPOLIA_USDC, BASE_SEPOLIA_ZORA_V4_HOOK);
        d.adapter = new MockSwapAdapter(10e6);
        d.rateModel = new InterestRateModel(
            InterestRateModel.Config(
                uint96(2e25), uint96(1e26), uint96(68e25), uint96(8e26), uint96(8e26), 1000
            )
        );
        d.riskManager =
            new MuseLendRiskManager(admin, address(d.timelock), guardian, false, 250_000e6, 250_000e6, 50);
        d.treasury = new ProtocolTreasury(IERC20Metadata(BASE_SEPOLIA_USDC), admin, address(d.timelock));
        d.validator = new CreatorTokenValidator(admin);
        d.seniorVault = new MuseLendUSDCVault(
            IERC20Metadata(BASE_SEPOLIA_USDC), admin, d.rateModel, address(d.treasury)
        );
        d.hedgeVault = new MuseLendHedgeEpochVault(IERC20Metadata(BASE_SEPOLIA_USDC), admin);
        d.receipt = new MuseLendPositionReceipt(admin);
        d.positionManager = new MuseLendPositionManager(
            IERC20Metadata(BASE_SEPOLIA_USDC),
            d.seniorVault,
            d.hedgeVault,
            d.receipt,
            d.riskManager,
            d.validator,
            admin,
            address(d.timelock),
            address(d.adapter),
            address(d.treasury)
        );
        d.seniorVault.setPositionManager(address(d.positionManager));
        d.hedgeVault.setPositionManager(address(d.positionManager));
        d.receipt.setPositionManager(address(d.positionManager));
        d.validator.setCanonical(address(d.creatorToken), 4);
        _handoffGovernance(d, admin);
        vm.stopBroadcast();

        _verify(d, admin, guardian);
        if (vm.envOr("WRITE_DEPLOYMENT_MANIFEST", true)) _writeManifest(d);
    }

    function _handoffGovernance(Deployment memory d, address admin) internal {
        address timelock = address(d.timelock);
        bytes32 defaultAdmin = d.riskManager.DEFAULT_ADMIN_ROLE();

        d.riskManager.grantRole(defaultAdmin, timelock);
        d.riskManager.renounceRole(defaultAdmin, admin);

        d.positionManager.grantRole(defaultAdmin, timelock);
        d.positionManager.renounceRole(defaultAdmin, admin);

        d.validator.grantRole(defaultAdmin, timelock);
        d.validator.grantRole(d.validator.VALIDATOR_ADMIN_ROLE(), timelock);
        d.validator.renounceRole(d.validator.VALIDATOR_ADMIN_ROLE(), admin);
        d.validator.renounceRole(defaultAdmin, admin);

        d.seniorVault.grantRole(defaultAdmin, timelock);
        d.seniorVault.grantRole(d.seniorVault.MANAGER_ADMIN_ROLE(), timelock);
        d.seniorVault.renounceRole(d.seniorVault.MANAGER_ADMIN_ROLE(), admin);
        d.seniorVault.renounceRole(defaultAdmin, admin);

        d.hedgeVault.grantRole(defaultAdmin, timelock);
        d.hedgeVault.grantRole(d.hedgeVault.EPOCH_ADMIN_ROLE(), timelock);
        d.hedgeVault.renounceRole(d.hedgeVault.EPOCH_ADMIN_ROLE(), admin);
        d.hedgeVault.renounceRole(defaultAdmin, admin);

        d.treasury.grantRole(defaultAdmin, timelock);
        d.treasury.renounceRole(defaultAdmin, admin);
    }

    function _verify(Deployment memory d, address admin, address guardian) internal view {
        address timelock = address(d.timelock);
        bytes32 defaultAdmin = d.riskManager.DEFAULT_ADMIN_ROLE();
        bool valid = !d.riskManager.mainnetEnabled()
            && d.riskManager.hasRole(d.riskManager.RISK_ADMIN_ROLE(), timelock)
            && d.riskManager.hasRole(d.riskManager.PAUSE_GUARDIAN_ROLE(), guardian)
            && d.positionManager.hasRole(d.positionManager.ADAPTER_ADMIN_ROLE(), timelock)
            && d.validator.hasRole(d.validator.VALIDATOR_ADMIN_ROLE(), timelock)
            && d.seniorVault.hasRole(d.seniorVault.MANAGER_ADMIN_ROLE(), timelock)
            && d.hedgeVault.hasRole(d.hedgeVault.EPOCH_ADMIN_ROLE(), timelock)
            && d.treasury.hasRole(d.treasury.FEE_MANAGER_ROLE(), timelock)
            && !d.riskManager.hasRole(defaultAdmin, admin) && !d.positionManager.hasRole(defaultAdmin, admin)
            && !d.validator.hasRole(defaultAdmin, admin) && !d.seniorVault.hasRole(defaultAdmin, admin)
            && !d.hedgeVault.hasRole(defaultAdmin, admin) && !d.treasury.hasRole(defaultAdmin, admin)
            && address(d.seniorVault.positionManager()) == address(d.positionManager)
            && address(d.hedgeVault.positionManager()) == address(d.positionManager)
            && d.receipt.positionManager() == address(d.positionManager)
            && d.positionManager.allowedAdapter(address(d.adapter)) && d.timelock.getMinDelay() == 1 days
            && d.validator.validate(address(d.creatorToken), 4);
        if (!valid) revert PostDeploymentInvariant();
    }

    function _writeManifest(Deployment memory d) internal {
        string memory object = "baseSepolia";
        vm.serializeUint(object, "chainId", block.chainid);
        vm.serializeUint(object, "deploymentBlock", block.number);
        vm.serializeAddress(object, "canonicalUsdc", BASE_SEPOLIA_USDC);
        vm.serializeAddress(object, "zoraV4Hook", BASE_SEPOLIA_ZORA_V4_HOOK);
        vm.serializeAddress(object, "creatorToken", address(d.creatorToken));
        vm.serializeAddress(object, "adapter", address(d.adapter));
        vm.serializeAddress(object, "rateModel", address(d.rateModel));
        vm.serializeAddress(object, "riskManager", address(d.riskManager));
        vm.serializeAddress(object, "validator", address(d.validator));
        vm.serializeAddress(object, "seniorVault", address(d.seniorVault));
        vm.serializeAddress(object, "hedgeVault", address(d.hedgeVault));
        vm.serializeAddress(object, "receipt", address(d.receipt));
        vm.serializeAddress(object, "positionManager", address(d.positionManager));
        vm.serializeAddress(object, "treasury", address(d.treasury));
        string memory json = vm.serializeAddress(object, "timelock", address(d.timelock));
        vm.writeJson(json, "deployments/base-sepolia.json");
    }
}
