"use client";

import { useEffect, useState } from "react";
import type { Hash } from "viem";
import { usePublicClient } from "wagmi";
import {
  trackFailure,
  trackReceipt,
  trackReplacement,
  type TrackedState,
} from "./tracked-transaction";

export function useTrackedTransaction(hash?: Hash) {
  const client = usePublicClient({ chainId: 84532 });
  const [tracked, setTracked] = useState<TrackedState>({ status: "idle" });

  useEffect(() => {
    let active = true;
    if (!hash || !client)
      return () => {
        active = false;
      };

    client
      .waitForTransactionReceipt({
        hash,
        onReplaced(replacement) {
          if (!active) return;
          setTracked(
            trackReplacement(
              hash,
              replacement.transaction.hash,
              replacement.reason,
            ),
          );
        },
      })
      .then((receipt) => {
        if (!active) return;
        setTracked((current) =>
          trackReceipt(
            current,
            hash,
            receipt.transactionHash,
            receipt.status === "success",
          ),
        );
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setTracked((current) => trackFailure(current, hash, cause));
      });
    return () => {
      active = false;
    };
  }, [client, hash]);

  if (tracked.sourceHash !== hash) {
    return {
      finalHash: hash,
      replacementReason: undefined,
      status: hash ? ("confirming" as const) : ("idle" as const),
      error: undefined,
    };
  }
  return tracked;
}
