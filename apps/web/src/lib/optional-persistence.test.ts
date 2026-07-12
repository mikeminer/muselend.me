import { afterEach, describe, expect, it } from "vitest";
import { cacheTokenMetadata, recordQuoteRequest } from "./optional-persistence";

afterEach(() => delete process.env.DATABASE_URL);

describe("optional persistence", () => {
  it("does not make a quote depend on a provisioned database", async () => {
    delete process.env.DATABASE_URL;
    await expect(recordQuoteRequest({ requestId: crypto.randomUUID(), kind: "sell", creatorToken: "0x1111111111111111111111111111111111111111", amount: "100", slippageBps: 100, deadline: 1, outcome: "quoted" })).resolves.toBeUndefined();
  });

  it("does not make chain metadata depend on a provisioned database", async () => {
    delete process.env.DATABASE_URL;
    await expect(cacheTokenMetadata({ address: "0x1111111111111111111111111111111111111111", name: "Creator", symbol: "CRT", decimals: 18 })).resolves.toBeUndefined();
  });
});
