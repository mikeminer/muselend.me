import { afterEach, describe, expect, it, vi } from "vitest";
import { requestContext } from "./api";

const redis = vi.hoisted(() => ({ eval: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));

afterEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  redis.eval.mockReset();
});

describe("requestContext", () => {
  it("limits repeated requests in the local fallback", async () => {
    const ip = `test-${crypto.randomUUID()}`;
    const request = () => new Request("http://localhost/api/test", { headers: { "x-forwarded-for": ip } });
    expect((await requestContext(request(), 2, 60_000)).limited).toBe(false);
    expect((await requestContext(request(), 2, 60_000)).limited).toBe(false);
    const blocked = await requestContext(request(), 2, 60_000);
    expect(blocked.limited).toBe(true);
    expect(blocked.backend).toBe("local");
  });

  it("replaces an unsafe caller-supplied request id", async () => {
    const context = await requestContext(new Request("http://localhost/api/test", { headers: { "x-request-id": "bad id with spaces" } }));
    expect(context.requestId).not.toContain(" ");
  });

  it("uses the atomic Redis result when production credentials exist", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    redis.eval.mockResolvedValue([4, 50_000]);
    const context = await requestContext(new Request("http://localhost/api/redis", { headers: { "x-forwarded-for": "203.0.113.1" } }), 3);
    expect(context).toMatchObject({ limited: true, remaining: 0, backend: "redis" });
    expect(redis.eval).toHaveBeenCalledOnce();
  });
});
