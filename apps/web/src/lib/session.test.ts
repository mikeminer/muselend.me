import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasSameOrigin } from "./api";
import { createSessionToken, readSession, validCsrf } from "./session";

const originalSecret = process.env.SESSION_SECRET;
const address = "0x0000000000000000000000000000000000000001" as const;

describe("wallet session security", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-only-session-secret-with-at-least-32-characters";
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it("round-trips an authenticated Base Sepolia session", async () => {
    const { token, session } = await createSessionToken(address);
    const request = new Request("https://muselend.me/api/risk/acknowledge", {
      headers: { cookie: `ml_session=${token}`, "x-csrf-token": session.csrf },
    });
    await expect(readSession(request)).resolves.toMatchObject({ address, chainId: 84532 });
    expect(validCsrf(request, session)).toBe(true);
  });

  it("rejects a tampered session signature", async () => {
    const { token } = await createSessionToken(address);
    const request = new Request("https://muselend.me/api/terms/accept", {
      headers: { cookie: `ml_session=${token.slice(0, -1)}x` },
    });
    await expect(readSession(request)).resolves.toBeNull();
  });

  it("requires an exact same-origin request", () => {
    expect(
      hasSameOrigin(
        new Request("https://muselend.me/api/auth/nonce", {
          headers: { origin: "https://muselend.me" },
        }),
      ),
    ).toBe(true);
    expect(
      hasSameOrigin(
        new Request("https://muselend.me/api/auth/nonce", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false);
  });
});
