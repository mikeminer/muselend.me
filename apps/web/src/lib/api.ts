import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getRedis } from "@/lib/redis";

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();
const rateLimitScript = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
local ttl = redis.call("PTTL", KEYS[1])
return {count, ttl}
`;

export async function requestContext(request: Request, limit = 30, windowMs = 60_000) {
  const suppliedId = request.headers.get("x-request-id");
  const requestId = suppliedId && /^[a-zA-Z0-9._:-]{1,128}$/.test(suppliedId) ? suppliedId : crypto.randomUUID();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const identity = await sha256(forwarded);
  const key = `ratelimit:${new URL(request.url).pathname}:${identity}`;
  const redisConfigured = Boolean(
    (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)
      && (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN),
  );

  if (redisConfigured) {
    try {
      const [count, ttl] = await getRedis().eval<[number], [number, number]>(rateLimitScript, [key], [windowMs]);
      return { requestId, limited: count > limit, remaining: Math.max(0, limit - count), resetAt: Date.now() + Math.max(0, ttl), backend: "redis" as const };
    } catch {
      if (process.env.NODE_ENV === "production") {
        return { requestId, limited: true, remaining: 0, resetAt: Date.now() + windowMs, backend: "redis-unavailable" as const };
      }
    }
  }

  const local = localRateLimit(key, limit, windowMs);
  return { requestId, ...local, backend: "local" as const };
}

function localRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) {
    bucket = { count: 1, reset: now + windowMs };
    buckets.set(key, bucket);
  } else {
    bucket.count += 1;
  }
  if (buckets.size > 10_000) {
    for (const [candidate, value] of buckets) if (value.reset <= now) buckets.delete(candidate);
  }
  return { limited: bucket.count > limit, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.reset };
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(bytes).toString("hex");
}

export function apiError(requestId: string, status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, details }, requestId }, { status, headers: { "cache-control": "no-store", "x-request-id": requestId } });
}

export async function parseBody<T>(request: Request, schema: ZodType<T>, requestId: string): Promise<T | NextResponse> {
  try {
    return schema.parse(await request.json());
  } catch (error) {
    return apiError(requestId, 400, "INVALID_REQUEST", "Request validation failed", error instanceof ZodError ? error.issues : undefined);
  }
}

export function rateLimitResponse(requestId: string) { return apiError(requestId, 429, "RATE_LIMITED", "Too many requests"); }

export function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}
