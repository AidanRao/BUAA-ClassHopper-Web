// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST, PUT, DELETE } from "../api/gateway";
const origin = "https://web.example.com";
const route = (path: string, query = "") =>
  `${origin}/api/gateway?__path=${encodeURIComponent(path)}${query}`;
beforeEach(() => {
  vi.stubEnv("SSO_ISSUER", "https://sso.example.com");
  vi.stubEnv("SSO_CLIENT_ID", "classhopper");
  vi.stubEnv("API_PLATFORM_BASE_URL", "https://api.example.com");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ code: 1, msg: "成功", data: [] })),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Vercel Function gateway", () => {
  it("serves runtime public config and forwards the original business query", async () => {
    expect(await (await GET(new Request(route("/app-config")))).json()).toEqual(
      { ssoIssuer: "https://sso.example.com", clientId: "classhopper" },
    );
    await GET(
      new Request(
        route("/api/buaa-classhopper/announcement", "&page=2&pageSize=10"),
        { headers: { Cookie: "sso=private", Authorization: "Bearer secret" } },
      ),
    );
    const [target, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(target)).toBe(
      "https://api.example.com/api/buaa-classhopper/announcement?page=2&pageSize=10",
    );
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    expect(new Headers(init?.headers).has("Cookie")).toBe(false);
  });
  it("preserves raw POST bodies, origin and user authorization", async () => {
    const body = JSON.stringify({
      date: "2026-10-27",
      courseScheduleId: "123",
      allowOutsideWindow: true,
    });
    const response = await POST(
      new Request(route("/api/buaa-classhopper/v1/iclass/sign-ins"), {
        method: "POST",
        headers: { Origin: origin, Authorization: "Bearer user" },
        body,
      }),
    );
    expect(response.status).toBe(200);
    const [target, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(target)).toBe(
      "https://api.example.com/api/buaa-classhopper/v1/iclass/sign-ins",
    );
    expect(init?.body).toBe(body);
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer user");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("keeps PKCE callback validation bound to the public Web origin", async () => {
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: "classhopper",
      code: "once",
      code_verifier: "verifier",
      redirect_uri: `${origin}/oauth/callback`,
    });
    const send = () =>
      POST(
        new Request(route("/oauth/token"), {
          method: "POST",
          headers: { Origin: origin },
          body: form,
        }),
      );
    expect((await send()).status).toBe(200);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "https://sso.example.com/oauth/token",
    );
    form.set("redirect_uri", "https://other.example.com/oauth/callback");
    expect((await send()).status).toBe(400);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects missing, ambiguous or invalid routes instead of serving SPA HTML", async () => {
    for (const url of [
      origin + "/api/gateway",
      route("/api/admin/apps"),
      route("//evil.example.com"),
      route("/app-config", "&__path=/oauth/token"),
      route("/app/schedule/2026-10-27"),
    ]) {
      const response = await GET(new Request(url));
      expect(response.status).toBe(404);
      expect(response.headers.get("Content-Type")).toContain(
        "application/json",
      );
    }
    expect(
      (
        await PUT(
          new Request(route("/api/buaa-classhopper/v1/iclass/authorization"), {
            method: "PUT",
            body: "{}",
          }),
        )
      ).status,
    ).toBe(405);
    expect(
      (
        await DELETE(
          new Request(route("/api/buaa-classhopper/v1/iclass/authorization"), {
            method: "DELETE",
            headers: { Origin: "https://evil.example.com" },
          }),
        )
      ).status,
    ).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("accepts an original-path request when the runtime preserves the source URL", async () => {
    const response = await GET(
      new Request(`${origin}/app-config?__path=/app-config`),
    );
    expect(response.status).toBe(200);
    expect(
      (await GET(new Request(`${origin}/app-config?__path=/oauth/userinfo`)))
        .status,
    ).toBe(400);
  });
});
