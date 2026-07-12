"use client";

import { useTranslations } from "next-intl";
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

export function TransactionStatus({ hash, walletPending, confirming, confirmed, error, label, replacementReason }: Props) {
  const t = useTranslations("Shared");
  const transactionLabel = label ?? t("transaction");
  if (!hash && !walletPending && !error) return null;
  const explorer = hash ? `https://sepolia.basescan.org/tx/${hash}` : undefined;
  return (
    <div className="space-y-2 rounded-xl border bg-card p-3 text-sm" aria-live="polite">
      <p className="font-medium">
        {walletPending ? t("reviewWallet") : confirming ? t("confirming") : replacementReason === "cancelled" ? t("cancelled", { label: transactionLabel }) : confirmed ? t("confirmed", { label: transactionLabel }) : t("notSubmitted")}
      </p>
      {hash ? <p className="break-all font-mono text-xs text-muted-foreground">{hash}</p> : null}
      {explorer ? <a className="inline-flex text-primary underline underline-offset-4" href={explorer} target="_blank" rel="noreferrer">{t("viewExplorer")}</a> : null}
      {error ? <p className="text-destructive">{t(friendlyErrorKey(error))}</p> : null}
      {replacementReason ? <p className="text-xs text-muted-foreground">{t("replacement", { reason: replacementReason })}</p> : null}
    </div>
  );
}

export function friendlyError(error: Error) {
  return ({ errorRejected: "The wallet request was rejected. No state changed.", errorGas: "The wallet does not have enough ETH for network gas.", errorRevert: "The transaction reverted during simulation or execution. No successful state change was recorded.", errorGeneric: "The wallet transaction failed. Review the wallet details and try again." } as const)[friendlyErrorKey(error)];
}

function friendlyErrorKey(error: Error) {
  const message = error.message.toLowerCase();
  if (message.includes("user rejected") || message.includes("user denied")) return "errorRejected" as const;
  if (message.includes("insufficient funds")) return "errorGas" as const;
  if (message.includes("revert")) return "errorRevert" as const;
  return "errorGeneric" as const;
}
