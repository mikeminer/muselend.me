import { SiweMessage } from "siwe";
import { NextResponse } from "next/server";
import { apiError, completeRequest, hasSameOrigin, parseBody, rateLimitResponse, requestContext, withTimeout } from "@/lib/api";
import { siweVerifyRequest } from "@/lib/api-schemas";
import { getRedis } from "@/lib/redis";
import {
  consumeNonce,
  createSessionToken,
  NONCE_COOKIE,
  readCookie,
  setSessionCookie,
} from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await requestContext(request, 10);
  if (context.limited) return rateLimitResponse(context.requestId);
  if (!hasSameOrigin(request)) return apiError(context.requestId, 403, "INVALID_ORIGIN", "Origin rejected");
  const body = await parseBody(request, siweVerifyRequest, context.requestId);
  if (body instanceof NextResponse) return body;
  try {
    const message = new SiweMessage(body.message);
    const nonce = readCookie(request, NONCE_COOKIE);
    const origin = new URL(request.url);
    if (!nonce || message.chainId !== 84532 || message.uri !== origin.origin) {
      return apiError(context.requestId, 401, "INVALID_SIWE", "SIWE binding rejected");
    }
    const result = await message.verify({
      signature: body.signature,
      domain: origin.host,
      nonce,
      time: new Date().toISOString(),
    });
    if (!result.success || !(await withTimeout(consumeNonce(getRedis(), nonce), 3_000))) {
      return apiError(context.requestId, 401, "INVALID_SIWE", "SIWE signature or nonce rejected");
    }
    const { token, session } = await createSessionToken(message.address as `0x${string}`);
    const response = NextResponse.json(
      { address: session.address, chainId: session.chainId, csrfToken: session.csrf, requestId: context.requestId },
      { headers: { "cache-control": "no-store", "x-request-id": context.requestId } },
    );
    setSessionCookie(response, token);
    response.cookies.set(NONCE_COOKIE, "", { path: "/api/auth", maxAge: 0 });
    completeRequest(context, 200);
    return response;
  } catch {
    return apiError(context.requestId, 401, "INVALID_SIWE", "SIWE verification failed");
  }
}
