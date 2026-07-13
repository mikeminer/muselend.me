import { describe, expect, it } from "vitest";
import { acceptanceRequest, quoteRequest, testnetClaimRequest, testnetClaimVoucher, tokenRequest } from "./api-schemas";

const wallet = "0x0000000000000000000000000000000000000001";

describe("public API schemas", () => {
  it("accepts only Base Sepolia token validation requests", () => {
    expect(tokenRequest.safeParse({ chainId: 84532, token: wallet }).success).toBe(true);
    expect(tokenRequest.safeParse({ chainId: 8453, token: wallet }).success).toBe(false);
  });

  it("rejects unsafe quote bounds", () => {
    const quote = {
      chainId: 84532,
      creatorToken: wallet,
      amount: "1000000",
      slippageBps: 50,
      deadline: 2_000_000_000,
    };

    expect(quoteRequest.safeParse(quote).success).toBe(true);
    expect(quoteRequest.safeParse({ ...quote, slippageBps: 1001 }).success).toBe(false);
    expect(quoteRequest.safeParse({ ...quote, amount: "1e6" }).success).toBe(false);
  });

  it("requires a signed, versioned acknowledgement", () => {
    expect(
      acceptanceRequest.safeParse({
        chainId: 84532,
        wallet,
        version: "2026-07-12",
        signature: "0x1234",
      }).success,
    ).toBe(true);
    expect(
      acceptanceRequest.safeParse({
        chainId: 84532,
        wallet,
        version: "",
        signature: "unsigned",
      }).success,
    ).toBe(false);
  });

  it("requires exact bounded metadata in testnet claim vouchers", () => {
    const claim = { wallet, sourceToken: wallet };
    expect(testnetClaimRequest.safeParse(claim).success).toBe(true);
    expect(testnetClaimVoucher.safeParse({
      ...claim,
      amount: "1000000000000000000",
      name: "Muse Coin",
      symbol: "MUSE",
      decimals: 18,
      deadline: 2_000_000_000,
    }).success).toBe(true);
    expect(testnetClaimVoucher.safeParse({
      ...claim,
      amount: "1e18",
      name: "Muse Coin",
      symbol: "MUSE",
      decimals: 18,
      deadline: 2_000_000_000,
    }).success).toBe(false);
  });
});
