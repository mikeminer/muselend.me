import { NextResponse, type NextRequest } from "next/server";

const publicDuringMaintenance = new Set([
  "/",
  "/maintenance",
  "/status",
  "/risk",
  "/terms",
  "/privacy",
  "/cookies",
  "/docs",
  "/api/health",
]);

export function proxy(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE !== "true" || publicDuringMaintenance.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.rewrite(new URL("/api/maintenance", request.url));
  }
  return NextResponse.rewrite(new URL("/maintenance", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg|apple-touch-icon.png|brand/).*)"],
};
