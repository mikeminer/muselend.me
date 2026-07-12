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
  const startedAt = Date.now();
  const route = new URL(request.url).pathname;
  const suppliedId = request.headers.get("x-request-id");
  const requestId = suppliedId && /^[a-zA-Z0-9._:-]{1,128}$/.test(suppliedId) ? suppliedId : crypto.randomUUID();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const identity = await sha256(forwarded);
  const key = `ratelimit:${route}:${identity}`;
  logApiEvent({ level: "info", event: "api.start", requestId, route });
  const redisConfigured = Boolean(
    (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)
      && (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN),
  );

  if (redisConfigured) {
    try {
      const [count, ttl] = await withTimeout(
        getRedis().eval<[number], [number, number]>(rateLimitScript, [key], [windowMs]),
        2_000,
      );
      return { requestId, route, startedAt, limited: count > limit, remaining: Math.max(0, limit - count), resetAt: Date.now() + Math.max(0, ttl), backend: "redis" as const };
    } catch {
      if (process.env.NODE_ENV === "production") {
        return { requestId, route, startedAt, limited: true, remaining: 0, resetAt: Date.now() + windowMs, backend: "redis-unavailable" as const };
      }
    }
  }

  const local = localRateLimit(key, limit, windowMs);
  return { requestId, route, startedAt, ...local, backend: "local" as const };
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
  logApiEvent({ level: status >= 500 ? "error" : "warn", event: "api.error", requestId, status, code });
  return NextResponse.json({ error: { code, message, details }, requestId }, { status, headers: { "cache-control": "no-store", "x-request-id": requestId } });
}

export function completeRequest(
  context: { requestId: string; route: string; startedAt: number; backend?: string },
  status: number,
) {
  logApiEvent({
    level: status >= 500 ? "error" : "info",
    event: "api.done",
    requestId: context.requestId,
    route: context.route,
    status,
    durationMs: Date.now() - context.startedAt,
    rateLimitBackend: context.backend,
  });
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs = 8_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new OperationTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class OperationTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Operation exceeded ${timeoutMs}ms`);
    this.name = "OperationTimeoutError";
  }
}

type LogField = string | number | boolean | undefined;
export function logApiEvent(fields: Record<string, LogField>) {
  const record = JSON.stringify({ service: "muselend-web", timestamp: new Date().toISOString(), ...fields });
  if (fields.level === "error") process.stderr.write(`${record}\n`);
  else process.stdout.write(`${record}\n`);
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
