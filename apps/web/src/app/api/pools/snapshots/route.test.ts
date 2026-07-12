import { afterEach, describe, expect, it } from "vitest";
import { epochSnapshot, GET } from "./route";

afterEach(() => {
  delete process.env.BASE_SEPOLIA_RPC_URL;
  delete process.env.NEXT_PUBLIC_SENIOR_VAULT_ADDRESS;
  delete process.env.NEXT_PUBLIC_HEDGE_EPOCH_VAULT_ADDRESS;
});

function request(search = "") {
  return new Request(`http://localhost/api/pools/snapshots${search}`, { headers: { "x-forwarded-for": `snapshot-${crypto.randomUUID()}` } });
}

describe("GET /api/pools/snapshots", () => {
  it("validates the bounded epoch limit", async () => {
    const response = await GET(request("?epochLimit=11"));
    expect(response.status).toBe(400);
  });

  it("fails closed without verified pool addresses", async () => {
    const response = await GET(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "DEPLOYMENT_MISSING" } });
  });

  it("serializes signed PnL and uint64 positions without JSON bigint values", () => {
    expect(epochSnapshot(3n, [1, 2, 3, 4, 5, 100n, 20n, 2n, -7n, 4n, false], 82n, 100n)).toMatchObject({ epochId: "3", realizedPnl: "-7", openPositions: "4", availableCoverage: "82" });
  });
});
