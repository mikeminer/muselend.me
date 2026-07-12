import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { apiError, completeRequest, parseBody, rateLimitResponse, requestContext, withTimeout } from "@/lib/api";
import { tokenRequest } from "@/lib/api-schemas";
import { cacheTokenMetadata } from "@/lib/optional-persistence";

const metadataAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

export async function POST(request: Request) {
  const context = await requestContext(request);
  if (context.limited) return rateLimitResponse(context.requestId);
  const body = await parseBody(request, tokenRequest, context.requestId);
  if (body instanceof NextResponse) return body;
  try {
    const client = createPublicClient({ chain: baseSepolia, transport: http(process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org") });
    const token = body.token as Address;
    const [name, symbol, decimals] = await withTimeout(Promise.all([
      client.readContract({ address: token, abi: metadataAbi, functionName: "name" }),
      client.readContract({ address: token, abi: metadataAbi, functionName: "symbol" }),
      client.readContract({ address: token, abi: metadataAbi, functionName: "decimals" }),
    ]));
    const safeName = name.slice(0, 128);
    const safeSymbol = symbol.slice(0, 32);
    await cacheTokenMetadata({ address: token, name: safeName, symbol: safeSymbol, decimals });
    completeRequest(context, 200);
    return NextResponse.json(
      { token, name: safeName, symbol: safeSymbol, decimals, source: "base-sepolia", requestId: context.requestId },
      { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300", "x-request-id": context.requestId } },
    );
  } catch {
    return apiError(context.requestId, 404, "TOKEN_METADATA_UNAVAILABLE", "ERC-20 metadata could not be read from Base Sepolia");
  }
}
