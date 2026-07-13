import { describe, expect, it } from "vitest";
import {
  borrowerWalletReady,
  hasSufficientTokenBalance,
  needsTokenApproval,
  quoteDeadlineIsFresh,
} from "./borrow-flow-state";

describe("borrower flow gates", () => {
  const configured = { deploymentConfigured: true, contractsConfigured: true };

  it("fails closed while the wallet is disconnected", () => {
    expect(
      borrowerWalletReady({
        ...configured,
        isConnected: false,
        chainId: 84532,
      }),
    ).toBe(false);
  });

  it("fails closed on the wrong wallet network", () => {
    expect(
      borrowerWalletReady({ ...configured, isConnected: true, chainId: 8453 }),
    ).toBe(false);
    expect(
      borrowerWalletReady({ ...configured, isConnected: true, chainId: 84532 }),
    ).toBe(true);
  });

  it("rejects an amount above the wallet token balance", () => {
    expect(hasSufficientTokenBalance(101n, 100n)).toBe(false);
    expect(hasSufficientTokenBalance(100n, 100n)).toBe(true);
  });

  it("requires approval only when allowance is insufficient", () => {
    expect(needsTokenApproval(100n, 99n)).toBe(true);
    expect(needsTokenApproval(100n, 100n)).toBe(false);
    expect(needsTokenApproval(0n, 0n)).toBe(false);
  });

  it("rejects stale quotes exactly at and after their deadline", () => {
    expect(quoteDeadlineIsFresh(1_000, 999_999)).toBe(true);
    expect(quoteDeadlineIsFresh(1_000, 1_000_000)).toBe(false);
    expect(quoteDeadlineIsFresh(undefined, 999_999)).toBe(false);
  });
});
