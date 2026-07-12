import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const secret = "s".repeat(32);

afterEach(() => {
  delete process.env.INDEXER_SYNC_SECRET;
  delete process.env.BASE_SEPOLIA_RPC_URL;
  delete process.env.DEPLOYMENT_BLOCK;
});

function request(authorization?: string) {
  const headers = new Headers({ "x-forwarded-for": `test-${crypto.randomUUID()}` });
  if (authorization) headers.set("authorization", authorization);
  return new Request("http://localhost/api/indexer/sync", { method: "POST", headers });
}

describe("POST /api/indexer/sync", () => {
  it("fails closed without a strong sync secret", async () => {
    const response = await POST(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INDEXER_UNCONFIGURED" } });
  });

  it("rejects a mismatched bearer token", async () => {
    process.env.INDEXER_SYNC_SECRET = secret;
    const response = await POST(request("Bearer wrong"));
    expect(response.status).toBe(401);
  });

  it("requires deployment and RPC configuration after authentication", async () => {
    process.env.INDEXER_SYNC_SECRET = secret;
    const response = await POST(request(`Bearer ${secret}`));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "DEPLOYMENT_MISSING" } });
  });
});
