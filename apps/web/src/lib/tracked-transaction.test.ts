import type { Hash } from "viem";
import { describe, expect, it } from "vitest";
import {
  trackFailure,
  trackReceipt,
  trackReplacement,
  type TrackedState,
} from "./tracked-transaction";

const sourceHash = `0x${"11".repeat(32)}` as Hash;
const replacementHash = `0x${"22".repeat(32)}` as Hash;

describe("tracked transaction lifecycle", () => {
  it("tracks a repriced transaction through its final successful receipt", () => {
    const replaced = trackReplacement(sourceHash, replacementHash, "repriced");
    expect(replaced).toMatchObject({
      sourceHash,
      finalHash: replacementHash,
      replacementReason: "repriced",
      status: "confirming",
    });

    expect(
      trackReceipt(replaced, sourceHash, replacementHash, true),
    ).toMatchObject({
      finalHash: replacementHash,
      replacementReason: "repriced",
      status: "confirmed",
    });
  });

  it("reports a reverted replacement without marking it confirmed", () => {
    const replaced = trackReplacement(sourceHash, replacementHash, "replaced");
    const reverted = trackReceipt(replaced, sourceHash, replacementHash, false);

    expect(reverted.status).toBe("reverted");
    expect(reverted.finalHash).toBe(replacementHash);
    expect(reverted.error?.message).toContain("reverted on chain");
  });

  it("preserves the final replacement hash when receipt tracking fails", () => {
    const replaced = trackReplacement(sourceHash, replacementHash, "repriced");
    const failed = trackFailure(
      replaced,
      sourceHash,
      new Error("RPC unavailable"),
    );

    expect(failed).toMatchObject({
      finalHash: replacementHash,
      status: "error",
    });
    expect(failed.error?.message).toBe("RPC unavailable");
  });

  it("sanitizes a non-Error tracking failure", () => {
    const initial: TrackedState = { status: "confirming" };
    const failed = trackFailure(initial, sourceHash, {
      providerSecret: "must-not-leak",
    });

    expect(failed.finalHash).toBe(sourceHash);
    expect(failed.error?.message).toBe("Receipt tracking failed");
  });
});
