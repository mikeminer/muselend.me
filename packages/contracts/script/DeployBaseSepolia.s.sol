// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;
import { Script } from "forge-std/Script.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { InterestRateModel } from "../src/InterestRateModel.sol";
import { MuseLendRiskManager } from "../src/MuseLendRiskManager.sol";
import { CreatorTokenValidator } from "../src/CreatorTokenValidator.sol";
import { MuseLendUSDCVault } from "../src/MuseLendUSDCVault.sol";
import { MuseLendHedgeEpochVault } from "../src/MuseLendHedgeEpochVault.sol";
import { MuseLendPositionReceipt } from "../src/MuseLendPositionReceipt.sol";
import { MuseLendPositionManager } from "../src/MuseLendPositionManager.sol";
import { ProtocolTreasury } from "../src/ProtocolTreasury.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";
import { MockSwapAdapter } from "../src/mocks/MockSwapAdapter.sol";

contract DeployBaseSepolia is Script {
    address constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    error WrongChain();
    error InvalidCanonicalUsdc();

    struct Deployment {
        MockERC20 creatorToken;
        MockSwapAdapter adapter;
        InterestRateModel rateModel;
        MuseLendRiskManager riskManager;
        CreatorTokenValidator validator;
        MuseLendUSDCVault seniorVault;
        MuseLendHedgeEpochVault hedgeVault;
        MuseLendPositionReceipt receipt;
        MuseLendPositionManager positionManager;
        ProtocolTreasury treasury;
    }

    function run() external returns (Deployment memory d) {
        if (block.chainid != 84532) revert WrongChain();
        if (BASE_SEPOLIA_USDC.code.length == 0 || IERC20Metadata(BASE_SEPOLIA_USDC).decimals() != 6) {
            revert InvalidCanonicalUsdc();
        }
        address admin = vm.envAddress("TESTNET_ADMIN");
        address riskAdmin = vm.envAddress("TESTNET_RISK_ADMIN");
        address guardian = vm.envAddress("TESTNET_PAUSE_GUARDIAN");
        address feeManager = vm.envAddress("TESTNET_FEE_MANAGER");
        vm.startBroadcast(admin);
        d.creatorToken = new MockERC20("Mock Zora Creator Token", "mCREATOR", 18);
        d.adapter = new MockSwapAdapter(10e6);
        d.rateModel = new InterestRateModel(
            InterestRateModel.Config(
                uint96(2e25), uint96(1e26), uint96(68e25), uint96(8e26), uint96(8e26), 1000
            )
        );
        d.riskManager = new MuseLendRiskManager(admin, riskAdmin, guardian, false, 250_000e6, 250_000e6);
        d.validator = new CreatorTokenValidator(admin);
        d.seniorVault = new MuseLendUSDCVault(IERC20Metadata(BASE_SEPOLIA_USDC), admin, d.rateModel);
        d.hedgeVault = new MuseLendHedgeEpochVault(IERC20Metadata(BASE_SEPOLIA_USDC), admin);
        d.receipt = new MuseLendPositionReceipt(admin);
        d.positionManager = new MuseLendPositionManager(
            IERC20Metadata(BASE_SEPOLIA_USDC),
            d.seniorVault,
            d.hedgeVault,
            d.receipt,
            d.riskManager,
            d.validator,
            admin
        );
        d.treasury = new ProtocolTreasury(IERC20Metadata(BASE_SEPOLIA_USDC), admin, feeManager);
        d.seniorVault.setPositionManager(address(d.positionManager));
        d.hedgeVault.setPositionManager(address(d.positionManager));
        d.receipt.setPositionManager(address(d.positionManager));
        d.positionManager.setAdapter(address(d.adapter), true);
        d.validator.setCanonical(address(d.creatorToken), 4);
        vm.stopBroadcast();
    }
}
