import { timingSafeEqual } from "node:crypto";
import { syncEvents } from "@muselend/indexer";
import { NextResponse } from "next/server";
import { apiError, completeRequest, rateLimitResponse, requestContext, withTimeout } from "@/lib/api";
import {
  configuredIndexerAddresses,
  createIndexStore,
  createReadClient,
  getLatestBlockNumber,
} from "@/lib/indexer-store";

export const maxDuration = 60;

export async function POST(request: Request) {
  const context = await requestContext(request, 5);
  if (context.limited) return rateLimitResponse(context.requestId);
  const expected = process.env.INDEXER_SYNC_SECRET;
  if (!expected || expected.length < 32) return apiError(context.requestId, 503, "INDEXER_UNCONFIGURED", "Indexer sync is not configured");
  if (!authorized(request.headers.get("authorization"), expected)) return apiError(context.requestId, 401, "UNAUTHORIZED", "Valid sync authorization required");

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL;
  const deployment = process.env.DEPLOYMENT_BLOCK;
  const addresses = configuredIndexerAddresses();
  if (!rpcUrl || !deployment || !/^\d+$/.test(deployment) || addresses.length === 0) {
    return apiError(context.requestId, 503, "DEPLOYMENT_MISSING", "Verified Base Sepolia deployment configuration is incomplete");
  }

  try {
    const latestBlock = await withTimeout(getLatestBlockNumber(rpcUrl));
    const result = await withTimeout(syncEvents(
      createReadClient(rpcUrl),
      createIndexStore(),
      latestBlock,
      {
        chainId: 84532,
        deploymentBlock: BigInt(deployment),
        confirmations: 5n,
        pageSize: 2_000n,
        addresses,
      },
    ), 25_000);
    completeRequest(context, 200);
    return NextResponse.json(
      {
        synced: true,
        chainId: 84532,
        safeHead: result.safeHead.toString(),
        fromBlock: result.fromBlock.toString(),
        indexedThrough: result.indexedThrough.toString(),
        contractCount: addresses.length,
        requestId: context.requestId,
      },
      { headers: { "cache-control": "no-store", "x-request-id": context.requestId } },
    );
  } catch {
    return apiError(context.requestId, 503, "INDEXER_SYNC_FAILED", "Indexer synchronization failed safely");
  }
}

function authorized(header: string | null, expected: string) {
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const actualBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
