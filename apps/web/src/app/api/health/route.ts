import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { const requestId=request.headers.get("x-request-id")??crypto.randomUUID(); return NextResponse.json({status:"ok",service:"muselend-web",network:"base-sepolia",mainnetEnabled:false,timestamp:new Date().toISOString()},{headers:{"cache-control":"no-store","x-request-id":requestId}}); }
