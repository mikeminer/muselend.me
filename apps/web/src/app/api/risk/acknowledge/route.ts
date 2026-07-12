import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { apiError, hasSameOrigin, parseBody, rateLimitResponse, requestContext } from "@/lib/api";
import { acceptanceRequest } from "@/lib/api-schemas";
import { getDatabase } from "@/db/client";
import { riskAcknowledgements } from "@/db/schema";
import { readSession, validCsrf } from "@/lib/session";

export async function POST(request: Request) {
  const context = requestContext(request, 10);
  if (context.limited) return rateLimitResponse(context.requestId);
  if (!hasSameOrigin(request)) return apiError(context.requestId, 403, "INVALID_ORIGIN", "Origin rejected");
  const body = await parseBody(request, acceptanceRequest, context.requestId);
  if (body instanceof NextResponse) return body;
  try {
    const session = await readSession(request);
    if (
      !session ||
      !validCsrf(request, session) ||
      session.address.toLowerCase() !== body.wallet.toLowerCase() ||
      session.chainId !== body.chainId
    ) {
      return apiError(context.requestId, 401, "WALLET_SESSION_REQUIRED", "Wallet session rejected");
    }
    const message = acceptanceMessage(body.wallet, body.chainId, body.version);
    const valid = await verifyMessage({
      address: body.wallet as `0x${string}`,
      message,
      signature: body.signature as `0x${string}`,
    });
    if (!valid) return apiError(context.requestId, 401, "INVALID_SIGNATURE", "Acknowledgement signature rejected");
    await getDatabase()
      .insert(riskAcknowledgements)
      .values({
        chainId: body.chainId,
        wallet: body.wallet.toLowerCase(),
        version: body.version,
        signature: body.signature,
      })
      .onConflictDoNothing();
    return NextResponse.json(
      { accepted: true, version: body.version, requestId: context.requestId },
      { status: 201, headers: { "cache-control": "no-store", "x-request-id": context.requestId } },
    );
  } catch {
    return apiError(context.requestId, 503, "PERSISTENCE_UNAVAILABLE", "Risk acknowledgement storage is unavailable");
  }
}

function acceptanceMessage(wallet: string, chainId: number, version: string) {
  return `MuseLend risk acceptance\nWallet: ${wallet.toLowerCase()}\nChain ID: ${chainId}\nVersion: ${version}`;
}
