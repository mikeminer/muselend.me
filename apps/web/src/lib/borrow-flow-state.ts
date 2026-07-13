export const BASE_SEPOLIA_CHAIN_ID = 84532;

type WalletReadinessInput = {
  deploymentConfigured: boolean;
  contractsConfigured: boolean;
  isConnected: boolean;
  chainId?: number;
};

export function borrowerWalletReady(input: WalletReadinessInput) {
  return (
    input.deploymentConfigured &&
    input.contractsConfigured &&
    input.isConnected &&
    input.chainId === BASE_SEPOLIA_CHAIN_ID
  );
}

export function hasSufficientTokenBalance(amount: bigint, balance: bigint) {
  return amount <= balance;
}

export function needsTokenApproval(amount: bigint, allowance: bigint) {
  return amount > 0n && allowance < amount;
}

export function quoteDeadlineIsFresh(
  deadlineSeconds: number | undefined,
  nowMilliseconds = Date.now(),
) {
  return (
    deadlineSeconds !== undefined && deadlineSeconds * 1_000 > nowMilliseconds
  );
}
