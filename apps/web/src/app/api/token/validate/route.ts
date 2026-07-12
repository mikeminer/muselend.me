import { CreatorTokenValidatorAbi } from "@muselend/abis";
import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { apiError, completeRequest, parseBody, rateLimitResponse, requestContext, withTimeout } from "@/lib/api";
import { tokenRequest } from "@/lib/api-schemas";

export async function POST(request: Request) {
  const context = await requestContext(request);
  if (context.limited) return rateLimitResponse(context.requestId);
  const body = await parseBody(request, tokenRequest, context.requestId);
  if (body instanceof NextResponse) return body;
  const validator = process.env.NEXT_PUBLIC_CREATOR_TOKEN_VALIDATOR_ADDRESS;
  if (!validator || !isAddress(validator)) {
    completeRequest(context, 200);
    return NextResponse.json(
      { valid: false, token: body.token, chainId: body.chainId, reason: "No verified Base Sepolia Zora Creator Coin validator is configured", requestId: context.requestId },
      { headers: { "cache-control": "no-store", "x-request-id": context.requestId } },
    );
  }
  try {
    const token = body.token as Address;
    const client = createPublicClient({ chain: baseSepolia, transport: http(process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org") });
    const version = await withTimeout(client.readContract({ address: validator, abi: CreatorTokenValidatorAbi, functionName: "canonicalVersion", args: [token] }));
    const valid = version > 0 && await withTimeout(client.readContract({ address: validator, abi: CreatorTokenValidatorAbi, functionName: "validate", args: [token, version] }));
    completeRequest(context, 200);
    return NextResponse.json(
      { valid, token: body.token, chainId: body.chainId, version: Number(version), reason: valid ? undefined : "Token is not registered or its live Zora interface no longer matches governance configuration", requestId: context.requestId },
      { headers: { "cache-control": "no-store", "x-request-id": context.requestId } },
    );
  } catch {
    return apiError(context.requestId, 503, "VALIDATOR_UNAVAILABLE", "The on-chain Creator Coin validator could not be read");
  }
}
