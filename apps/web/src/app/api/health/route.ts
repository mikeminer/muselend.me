import { NextResponse } from "next/server";
import { deploymentConfigured } from "@/lib/contracts";
import { logApiEvent } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  logApiEvent({ level: "info", event: "api.start", requestId, route: "/api/health" });
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const redisConfigured = Boolean(
    (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)
      && (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN),
  );
  const readiness = {
    contracts: deploymentConfigured,
    database: databaseConfigured,
    redis: redisConfigured,
    vercel: Boolean(process.env.VERCEL_ENV),
  };
  const readyForTransactions = readiness.contracts && readiness.database && readiness.redis;
  logApiEvent({ level: "info", event: "api.done", requestId, route: "/api/health", status: 200, durationMs: Date.now() - startedAt });
  return NextResponse.json(
    {
      status: "ok",
      service: "muselend-web",
      network: "base-sepolia",
      mainnetEnabled: false,
      readyForTransactions,
      readiness,
      timestamp: new Date().toISOString(),
      requestId,
    },
    { headers: { "cache-control": "no-store", "x-request-id": requestId } },
  );
}
