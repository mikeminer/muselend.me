"use client";

import { useEffect, useState } from "react";
import type { Hash, ReplacementReason } from "viem";
import { usePublicClient } from "wagmi";

export function useTrackedTransaction(hash?: Hash) {
  const client = usePublicClient({ chainId: 84532 });
  const [tracked, setTracked] = useState<TrackedState>({ status: "idle" });

  useEffect(() => {
    let active = true;
    if (!hash || !client) return () => { active = false; };

    client.waitForTransactionReceipt({
      hash,
      onReplaced(replacement) {
        if (!active) return;
        setTracked({ sourceHash: hash, finalHash: replacement.transaction.hash, replacementReason: replacement.reason, status: "confirming" });
      },
    }).then((receipt) => {
      if (!active) return;
      setTracked((current) => ({
        ...current,
        sourceHash: hash,
        finalHash: receipt.transactionHash,
        error: receipt.status === "reverted" ? new Error("Transaction reverted on chain") : undefined,
        status: receipt.status === "success" ? "confirmed" : "reverted",
      }));
    }).catch((cause: unknown) => {
      if (!active) return;
      setTracked((current) => ({ ...current, sourceHash: hash, finalHash: current.finalHash ?? hash, error: cause instanceof Error ? cause : new Error("Receipt tracking failed"), status: "error" }));
    });
    return () => { active = false; };
  }, [client, hash]);

  if (tracked.sourceHash !== hash) {
    return { finalHash: hash, replacementReason: undefined, status: hash ? "confirming" as const : "idle" as const, error: undefined };
  }
  return tracked;
}

type TrackedState = {
  sourceHash?: Hash;
  finalHash?: Hash;
  replacementReason?: ReplacementReason;
  status: "idle" | "confirming" | "confirmed" | "reverted" | "error";
  error?: Error;
};
