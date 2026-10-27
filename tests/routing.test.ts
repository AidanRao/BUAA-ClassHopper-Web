// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getTransformedRoutes } from "@vercel/routing-utils";
import config from "../vercel.json";
import { GET } from "../api/gateway";

const transformed = getTransformedRoutes(config);
const rewrites =
  transformed.routes?.filter(
    (route) => "dest" in route && typeof route.dest === "string",
  ) ?? [];
function rewrite(path: string) {
  for (const route of rewrites) {
    if (!("src" in route) || !route.src || !("dest" in route)) continue;
    const pattern = new RegExp(route.src);
    if (pattern.test(path)) return path.replace(pattern, route.dest!);
  }
}
describe("Vercel platform routing", () => {
  it("accepts configuration and preserves the filesystem check before SPA fallback", () => {
    expect(transformed.error).toBeNull();
    expect(
      transformed.routes?.findIndex(
        (r) => "handle" in r && r.handle === "filesystem",
      ),
    ).toBeLessThan(transformed.routes!.findIndex((r) => "dest" in r));
    expect(config.functions["api/gateway.ts"].maxDuration).toBeGreaterThan(35);
  });
  it("keeps page deep links and OAuth callbacks inside the SPA", () => {
    for (const path of [
      "/",
      "/schedule/2026-10-27/course-123",
      "/announcements/123",
      "/account",
      "/oauth/callback",
      "/unknown",
    ])
      expect(rewrite(path)).toBe("/index.html");
  });
  it("routes API and SSO to the function without injecting path parameters", async () => {
    for (const path of [
      "/app-config",
      "/oauth/token",
      "/oauth/userinfo",
      "/api",
      "/api/admin/apps",
      "/api/buaa-classhopper/v1/iclass/sign-ins",
    ]) {
      const destination = new URL(rewrite(path)!, "https://web.example.com");
      expect(destination.pathname).toBe("/api/gateway");
      expect([...destination.searchParams]).toEqual([["__path", path]]);
    }
    const response = await GET(
      new Request(
        new URL(rewrite("/api/admin/apps")!, "https://web.example.com"),
      ),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });
  it("never serves HTML for malformed reserved prefixes", () => {
    for (const path of [
      "/app-config/extra",
      "/oauth/token/extra",
      "/oauth/userinfo/extra",
    ])
      expect(rewrite(path)).toBeUndefined();
  });
});
