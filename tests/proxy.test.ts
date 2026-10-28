// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleProxy } from "../server/proxy";
const env = {
  SSO_ISSUER: "https://sso.example.com",
  SSO_CLIENT_ID: "classhopper",
  API_PLATFORM_BASE_URL: "https://api.example.com",
};
const origin = "https://web.example.com";
let sent: { url: string; init: RequestInit }[];
beforeEach(() => {
  sent = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      sent.push({ url: String(url), init });
      return Response.json(
        { code: 1, data: [] },
        { headers: { "Set-Cookie": "secret=bad", "Cache-Control": "public" } },
      );
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
const request = (path: string, init?: RequestInit) =>
  new Request(origin + path, init);
describe("fixed upstream same-origin proxy", () => {
  it("strips credentials from anonymous announcements and advertisements", async () => {
    for (const path of [
      "/api/buaa-classhopper/announcement?page=2",
      "/api/buaa-classhopper/ads/slots/web-schedule-banner",
    ]) {
      const result = await handleProxy(
        request(path, {
          headers: { Authorization: "Bearer private", Cookie: "sso=private" },
        }),
        env,
      );
      expect(new Headers(sent.at(-1)!.init.headers).has("Authorization")).toBe(
        false,
      );
      expect(new Headers(sent.at(-1)!.init.headers).has("Cookie")).toBe(false);
      expect(result!.headers.has("Set-Cookie")).toBe(false);
      expect(result!.headers.get("Cache-Control")).toBe("no-store");
    }
    expect(sent[0].url).toBe(
      "https://api.example.com/api/buaa-classhopper/announcement?page=2",
    );
  });
  it("forwards only user Bearer to personal endpoints and blocks unknown routes/methods", async () => {
    await handleProxy(
      request("/api/buaa-classhopper/v1/iclass/authorization", {
        headers: { Authorization: "Bearer user", Cookie: "x=y" },
      }),
      env,
    );
    expect(new Headers(sent[0].init.headers).get("Authorization")).toBe(
      "Bearer user",
    );
    expect(new Headers(sent[0].init.headers).has("Cookie")).toBe(false);
    expect((await handleProxy(request("/api/admin/apps"), env))!.status).toBe(
      404,
    );
    expect(
      (await handleProxy(
        request("/api/buaa-classhopper/v1/iclass/authorization", {
          method: "PUT",
          body: "{}",
        }),
        env,
      ))!.status,
    ).toBe(405);
    expect(await handleProxy(request("/app/schedule/2026-10-27/123"), env)).toBe(
      null,
    );
  });
  it("validates token grant, client, duplicate fields and exact callback", async () => {
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: "classhopper",
      code: "one-time",
      code_verifier: "verifier",
      redirect_uri: origin + "/oauth/callback",
    });
    const call = (body: string) =>
      handleProxy(
        request("/oauth/token", {
          method: "POST",
          body,
          headers: { Origin: origin, Cookie: "sso=bad" },
        }),
        env,
      );
    expect((await call(form.toString()))!.status).toBe(200);
    expect(sent[0].url).toBe("https://sso.example.com/oauth/token");
    expect(new Headers(sent[0].init.headers).has("Cookie")).toBe(false);
    expect((await call(form.toString() + "&client_secret=bad"))!.status).toBe(
      400,
    );
    expect(
      (await call(form.toString() + "&client_id=classhopper"))!.status,
    ).toBe(400);
    form.set("redirect_uri", "https://evil.example/oauth/callback");
    expect((await call(form.toString()))!.status).toBe(400);
  });
  it("rejects cross-site actions, oversized bodies and upstream redirects", async () => {
    const path = "/api/buaa-classhopper/v1/iclass/sign-ins";
    expect(
      (await handleProxy(
        request(path, {
          method: "POST",
          body: "{}",
          headers: { Origin: "https://evil.example" },
        }),
        env,
      ))!.status,
    ).toBe(403);
    expect(
      (await handleProxy(
        request(path, { method: "POST", body: "x".repeat(16385) }),
        env,
      ))!.status,
    ).toBe(413);
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.redirect("https://evil.example", 302),
    );
    expect((await handleProxy(request("/oauth/userinfo"), env))!.status).toBe(
      502,
    );
  });
});
