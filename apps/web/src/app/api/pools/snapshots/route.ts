import { NextResponse } from "next/server";
import { rateLimitResponse, requestContext } from "@/lib/api";

export async function GET(request: Request) {
  const context = await requestContext(request);
  if (context.limited) return rateLimitResponse(context.requestId);
  return NextResponse.json(
    { chainId: 84532, senior: null, epochs: [], source: "contracts-not-deployed", requestId: context.requestId },
    { headers: { "cache-control": "public, max-age=10, stale-while-revalidate=30", "x-request-id": context.requestId } },
  );
}
