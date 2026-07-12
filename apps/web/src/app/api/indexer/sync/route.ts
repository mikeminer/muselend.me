import { apiError, rateLimitResponse, requestContext } from "@/lib/api";

export async function POST(request: Request) {
  const context = await requestContext(request, 5);
  if (context.limited) return rateLimitResponse(context.requestId);
  const expected = process.env.INDEXER_SYNC_SECRET;
  if (!expected) return apiError(context.requestId, 503, "INDEXER_UNCONFIGURED", "Indexer sync is not configured");
  if (request.headers.get("authorization") !== `Bearer ${expected}`) return apiError(context.requestId, 401, "UNAUTHORIZED", "Valid sync authorization required");
  return apiError(context.requestId, 503, "DEPLOYMENT_MISSING", "No Base Sepolia deployment block is configured");
}
