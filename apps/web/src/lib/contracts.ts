import { isAddress, type Address } from "viem";

const seniorVault = process.env.NEXT_PUBLIC_SENIOR_VAULT_ADDRESS;
const hedgeEpochVault = process.env.NEXT_PUBLIC_HEDGE_EPOCH_VAULT_ADDRESS;
const positionManager = process.env.NEXT_PUBLIC_POSITION_MANAGER_ADDRESS;
const swapAdapter = process.env.NEXT_PUBLIC_SWAP_ADAPTER_ADDRESS;
const interestRateModel = process.env.NEXT_PUBLIC_INTEREST_RATE_MODEL_ADDRESS;
const creatorTokenValidator = process.env.NEXT_PUBLIC_CREATOR_TOKEN_VALIDATOR_ADDRESS;
const creatorToken = process.env.NEXT_PUBLIC_CREATOR_TOKEN_ADDRESS;
const creatorMirrorFactory = process.env.NEXT_PUBLIC_CREATOR_MIRROR_FACTORY_ADDRESS;
const riskManager = process.env.NEXT_PUBLIC_RISK_MANAGER_ADDRESS;
const timelock = process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS;
const usdc = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const deploymentBlockValue = process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK;

function optionalAddress(value: string | undefined): Address | undefined {
  return value && isAddress(value) ? value : undefined;
}

export const contracts = {
  seniorVault: optionalAddress(seniorVault),
  hedgeEpochVault: optionalAddress(hedgeEpochVault),
  positionManager: optionalAddress(positionManager),
  swapAdapter: optionalAddress(swapAdapter),
  interestRateModel: optionalAddress(interestRateModel),
  creatorTokenValidator: optionalAddress(creatorTokenValidator),
  creatorToken: optionalAddress(creatorToken),
  creatorMirrorFactory: optionalAddress(creatorMirrorFactory),
  riskManager: optionalAddress(riskManager),
  timelock: optionalAddress(timelock),
  usdc: optionalAddress(usdc),
} as const;

export const deploymentConfigured = Boolean(
  contracts.seniorVault && contracts.hedgeEpochVault && contracts.positionManager && contracts.creatorTokenValidator && contracts.creatorToken && contracts.riskManager && contracts.timelock && contracts.usdc,
);

export const deploymentBlock = deploymentBlockValue && /^\d+$/.test(deploymentBlockValue)
  ? BigInt(deploymentBlockValue)
  : undefined;
