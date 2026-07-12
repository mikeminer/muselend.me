import { NextResponse } from "next/server";

export async function GET() { return unavailable(); }
export async function POST() { return unavailable(); }
export async function PUT() { return unavailable(); }
export async function PATCH() { return unavailable(); }
export async function DELETE() { return unavailable(); }

function unavailable() {
  const requestId = crypto.randomUUID();
  return NextResponse.json(
    { error: { code: "MAINTENANCE", message: "MuseLend transactional services are temporarily unavailable" }, requestId },
    { status: 503, headers: { "cache-control": "no-store", "retry-after": "300", "x-request-id": requestId } },
  );
}
