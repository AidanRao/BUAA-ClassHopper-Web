// @vitest-environment node
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { localProxy } from "../server/local-proxy";
const realFetch = globalThis.fetch;
const servers: Server[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeAllConnections();
        }),
    ),
  );
});
async function start() {
  const server = createServer((req, res) => {
    void localProxy(
      req,
      res,
      () => {
        res.end("SPA fallback");
      },
      {
        SSO_ISSUER: "https://sso.example.com",
        SSO_CLIENT_ID: "classhopper",
        API_PLATFORM_BASE_URL: "https://api.example.com",
      },
    );
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("no server address");
  return `http://127.0.0.1:${address.port}`;
}
describe("local Node HTTP proxy", () => {
  it("keeps deep links in the SPA and reserved API routes in JSON", async () => {
    const origin = await start();
    expect(
      await (await realFetch(origin + "/schedule/2026-10-27/123")).text(),
    ).toBe("SPA fallback");
    const unknown = await realFetch(origin + "/api/admin/apps");
    expect(unknown.status).toBe(404);
    expect(unknown.headers.get("Content-Type")).toContain("application/json");
    expect(await (await realFetch(origin + "/app-config")).json()).toEqual({
      ssoIssuer: "https://sso.example.com",
      clientId: "classhopper",
    });
  });
  it("forwards the exact sign-in body and bearer through the Node HTTP boundary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { code: 1, data: { signed: true } },
          { headers: { "Set-Cookie": "upstream=secret" } },
        ),
      ),
    );
    const origin = await start();
    const body = JSON.stringify({
      date: "2026-10-27",
      courseScheduleId: "123",
      allowOutsideWindow: true,
    });
    const response = await realFetch(
      origin + "/api/buaa-classhopper/v1/iclass/sign-ins",
      {
        method: "POST",
        headers: {
          Origin: origin,
          Authorization: "Bearer user",
          Cookie: "private=secret",
        },
        body,
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ code: 1, data: { signed: true } });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.has("Set-Cookie")).toBe(false);
    const [target, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(target)).toBe(
      "https://api.example.com/api/buaa-classhopper/v1/iclass/sign-ins",
    );
    expect(init?.body).toBe(body);
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer user");
    expect(new Headers(init?.headers).has("Cookie")).toBe(false);
  });
});
