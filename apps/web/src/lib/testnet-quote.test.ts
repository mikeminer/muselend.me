import { afterEach, describe, expect, it } from "vitest";
import { POST as buyExactOutput } from "@/app/api/quote/buy-exact-output/route";
import { divideUp } from "./testnet-quote";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SWAP_ADAPTER_ADDRESS;
  delete process.env.NEXT_PUBLIC_POSITION_MANAGER_ADDRESS;
  delete process.env.NEXT_PUBLIC_CREATOR_TOKEN_VALIDATOR_ADDRESS;
});

describe("testnet buy quote", () => {
  it("rounds exact-output cost upward", () => {
    expect(divideUp(10n, 3n)).toBe(4n);
    expect(divideUp(0n, 3n)).toBe(0n);
  });

  it("fails closed without a verified adapter deployment", async () => {
    const response = await buyExactOutput(new Request("http://localhost/api/quote/buy-exact-output", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `quote-${crypto.randomUUID()}` },
      body: JSON.stringify({ chainId: 84532, creatorToken: "0x1111111111111111111111111111111111111111", amount: "1000000000000000000", slippageBps: 100, deadline: Math.floor(Date.now() / 1000) + 300 }),
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "QUOTE_UNAVAILABLE", details: { calldataReturned: false } } });
  });
});
