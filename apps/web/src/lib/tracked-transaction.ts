import type { Hash, ReplacementReason } from "viem";

export type TrackedState = {
  sourceHash?: Hash;
  finalHash?: Hash;
  replacementReason?: ReplacementReason;
  status: "idle" | "confirming" | "confirmed" | "reverted" | "error";
  error?: Error;
};

export function trackReplacement(
  sourceHash: Hash,
  finalHash: Hash,
  replacementReason: ReplacementReason,
): TrackedState {
  return { sourceHash, finalHash, replacementReason, status: "confirming" };
}

export function trackReceipt(
  current: TrackedState,
  sourceHash: Hash,
  finalHash: Hash,
  succeeded: boolean,
): TrackedState {
  return {
    ...current,
    sourceHash,
    finalHash,
    error: succeeded ? undefined : new Error("Transaction reverted on chain"),
    status: succeeded ? "confirmed" : "reverted",
  };
}

export function trackFailure(
  current: TrackedState,
  sourceHash: Hash,
  cause: unknown,
): TrackedState {
  return {
    ...current,
    sourceHash,
    finalHash: current.finalHash ?? sourceHash,
    error:
      cause instanceof Error ? cause : new Error("Receipt tracking failed"),
    status: "error",
  };
}
