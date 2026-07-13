import { getProfileBalances, setApiKey } from "@zoralabs/coins-sdk";
import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { apiError, completeRequest, parseBody, rateLimitResponse, requestContext, withTimeout } from "@/lib/api";
import { testnetClaimDiscovery, testnetClaimRequest } from "@/lib/api-schemas";
import { createClaimAttestation } from "@/lib/testnet-claim";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await requestContext(request, 15);
  if (context.limited) return rateLimitResponse(context.requestId);
  const parsed = testnetClaimDiscovery.safeParse({ wallet: new URL(request.url).searchParams.get("wallet") });
  if (!parsed.success) return apiError(context.requestId, 400, "INVALID_REQUEST", "A valid wallet address is required");
  try {
    setApiKey(process.env.ZORA_API_KEY);
    const result = await withTimeout(getProfileBalances({ identifier: parsed.data.wallet, count: 50, sortOption: "BALANCE", excludeHidden: true, chainIds: [8453] }), 8_000);
    const tokens = (result.data?.profile?.coinBalances.edges ?? [])
      .map(({ node }) => node.coin && node.coin.coinType === "CREATOR" && node.coin.chainId === 8453 && isAddress(node.coin.address)
        ? { address: node.coin.address as Address, name: node.coin.name, symbol: node.coin.symbol, balance: node.walletBalance }
        : undefined)
      .filter((token): token is NonNullable<typeof token> => Boolean(token));
    completeRequest(context, 200);
    return NextResponse.json({ tokens, discoveryAvailable: true, requestId: context.requestId }, { headers: noStore(context.requestId) });
  } catch {
    completeRequest(context, 200);
    return NextResponse.json({ tokens: [], discoveryAvailable: false, requestId: context.requestId }, { headers: noStore(context.requestId) });
  }
}

export async function POST(request: Request) {
  const context = await requestContext(request, 10);
  if (context.limited) return rateLimitResponse(context.requestId);
  const body = await parseBody(request, testnetClaimRequest, context.requestId);
  if (body instanceof NextResponse) return body;
  try {
    const result = await withTimeout(createClaimAttestation(body.wallet as Address, body.sourceToken as Address), 12_000);
    const response = {
      wallet: body.wallet,
      sourceToken: body.sourceToken,
      ...result,
      sourceBalance: result.sourceBalance.toString(),
      voucher: result.voucher ? { ...result.voucher, amount: result.voucher.amount.toString(), deadline: Number(result.voucher.deadline) } : undefined,
      requestId: context.requestId,
    };
    completeRequest(context, 200);
    return NextResponse.json(response, { headers: noStore(context.requestId) });
  } catch (error) {
    const code = normalizeClaimErrorCode(error);
    const unavailable = code.startsWith("CLAIM_");
    return apiError(context.requestId, unavailable ? 503 : 422, code, claimErrorMessage(code));
  }
}

const claimErrorCodes = new Set([
  "CLAIM_FACTORY_NOT_CONFIGURED",
  "CLAIM_ATTESTER_NOT_CONFIGURED",
  "CLAIM_ATTESTER_MISMATCH",
  "SOURCE_TOKEN_NOT_FOUND",
  "ZERO_SOURCE_BALANCE",
  "NOT_A_CREATOR_COIN",
  "NON_CANONICAL_CREATOR_COIN",
  "INVALID_TOKEN_NAME",
  "INVALID_TOKEN_SYMBOL",
  "INVALID_TOKEN_DECIMALS",
]);

export function normalizeClaimErrorCode(error: unknown) {
  const rawCode = error instanceof Error ? error.message : "CLAIM_UNAVAILABLE";
  return claimErrorCodes.has(rawCode) ? rawCode : "CLAIM_UNAVAILABLE";
}

function noStore(requestId: string) {
  return { "cache-control": "no-store", "x-request-id": requestId };
}

function claimErrorMessage(code: string) {
  if (code === "ZERO_SOURCE_BALANCE") return "The connected wallet has no balance for this token on Base";
  if (code === "SOURCE_TOKEN_NOT_FOUND") return "No token contract exists at this Base address";
  if (code === "NOT_A_CREATOR_COIN" || code === "NON_CANONICAL_CREATOR_COIN") return "The Base token is not a canonical Zora Creator Coin";
  if (code.startsWith("INVALID_TOKEN_")) return "The source token metadata cannot be mirrored exactly";
  if (code.startsWith("CLAIM_")) return "The Base Sepolia claim service is not configured or is temporarily unavailable";
  return "The Base Creator Coin could not be verified";
}
