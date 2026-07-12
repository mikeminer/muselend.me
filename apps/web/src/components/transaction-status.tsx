"use client";

import type { Hash, ReplacementReason } from "viem";

type Props = {
  hash?: Hash;
  walletPending: boolean;
  confirming: boolean;
  confirmed: boolean;
  error?: Error | null;
  label?: string;
  replacementReason?: ReplacementReason;
};

export function TransactionStatus({ hash, walletPending, confirming, confirmed, error, label = "Transaction", replacementReason }: Props) {
  if (!hash && !walletPending && !error) return null;
  const explorer = hash ? `https://sepolia.basescan.org/tx/${hash}` : undefined;
  return (
    <div className="space-y-2 rounded-xl border bg-card p-3 text-sm" aria-live="polite">
      <p className="font-medium">
        {walletPending ? "Review the request in your wallet" : confirming ? "Waiting for Base Sepolia confirmation" : replacementReason === "cancelled" ? `${label} cancelled in wallet` : confirmed ? `${label} confirmed` : "Transaction was not submitted"}
      </p>
      {hash ? <p className="break-all font-mono text-xs text-muted-foreground">{hash}</p> : null}
      {explorer ? <a className="inline-flex text-primary underline underline-offset-4" href={explorer} target="_blank" rel="noreferrer">View on BaseScan</a> : null}
      {error ? <p className="text-destructive">{friendlyError(error)}</p> : null}
      {replacementReason ? <p className="text-xs text-muted-foreground">Wallet replacement detected: {replacementReason}. The hash above is the canonical replacement transaction.</p> : null}
    </div>
  );
}

export function friendlyError(error: Error) {
  const message = error.message.toLowerCase();
  if (message.includes("user rejected") || message.includes("user denied")) return "The wallet request was rejected. No state changed.";
  if (message.includes("insufficient funds")) return "The wallet does not have enough ETH for network gas.";
  if (message.includes("revert")) return "The transaction reverted during simulation or execution. No successful state change was recorded.";
  return "The wallet transaction failed. Review the wallet details and try again.";
}
