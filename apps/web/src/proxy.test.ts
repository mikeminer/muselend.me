import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

afterEach(() => { delete process.env.MAINTENANCE_MODE; });

describe("maintenance proxy", () => {
  it("rewrites product pages while preserving health", () => {
    process.env.MAINTENANCE_MODE = "true";
    const application = proxy(new NextRequest("https://muselend.me/app/borrow"));
    const health = proxy(new NextRequest("https://muselend.me/api/health"));
    expect(application.headers.get("x-middleware-rewrite")).toBe("https://muselend.me/maintenance");
    expect(health.headers.get("x-middleware-next")).toBe("1");
  });

  it("rewrites APIs to the explicit 503 handler", () => {
    process.env.MAINTENANCE_MODE = "true";
    const response = proxy(new NextRequest("https://muselend.me/api/quote/sell"));
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://muselend.me/api/maintenance");
  });
});
