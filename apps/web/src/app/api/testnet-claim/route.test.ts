import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, normalizeClaimErrorCode, POST } from "./route";

const wallet = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("testnet claim API", () => {
  it("rejects discovery without a valid wallet", async () => {
    const response = await GET(new Request("http://localhost/api/testnet-claim?wallet=bad"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_REQUEST");
  });

  it("rejects malformed claim input before any chain read", async () => {
    const response = await POST(new Request("http://localhost/api/testnet-claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet, sourceToken: "bad" }),
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_REQUEST");
  });

  it("fails closed when the factory or attester is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_CREATOR_MIRROR_FACTORY_ADDRESS", "");
    vi.stubEnv("TESTNET_CLAIM_ATTESTER_PRIVATE_KEY", "");
    const response = await POST(new Request("http://localhost/api/testnet-claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet, sourceToken: token }),
    }));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("CLAIM_FACTORY_NOT_CONFIGURED");
  });

  it("does not expose raw provider errors as public error codes", () => {
    expect(normalizeClaimErrorCode(new Error("RPC failed: internal provider detail"))).toBe("CLAIM_UNAVAILABLE");
    expect(normalizeClaimErrorCode(new Error("ZERO_SOURCE_BALANCE"))).toBe("ZERO_SOURCE_BALANCE");
  });
});
