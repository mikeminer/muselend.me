import { generateNonce } from "siwe";
import { NextResponse } from "next/server";
import { apiError, hasSameOrigin, rateLimitResponse, requestContext } from "@/lib/api";
import { getRedis } from "@/lib/redis";
import { NONCE_COOKIE, nonceKey } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await requestContext(request, 10);
  if (context.limited) return rateLimitResponse(context.requestId);
  if (!hasSameOrigin(request)) return apiError(context.requestId, 403, "INVALID_ORIGIN", "Origin rejected");
  try {
    const nonce = generateNonce();
    const redis = getRedis();
    await redis.set(nonceKey(nonce), "pending", { ex: 300, nx: true });
    const response = NextResponse.json(
      { nonce, chainId: 84532, domain: new URL(request.url).host, requestId: context.requestId },
      { headers: { "cache-control": "no-store", "x-request-id": context.requestId } },
    );
    response.cookies.set(NONCE_COOKIE, nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      maxAge: 300,
    });
    return response;
  } catch {
    return apiError(context.requestId, 503, "AUTH_UNAVAILABLE", "Wallet authentication is unavailable");
  }
}
