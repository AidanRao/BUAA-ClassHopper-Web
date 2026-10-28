import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { BrowserSession, pkceChallenge } from "../src/auth/session";
const config = {
  ssoIssuer: "https://sso.example.com",
  clientId: "classhopper",
};
const storageKey = "classhopper.session.v1";
const profile = { id: "user-1", username: "同学" };
const token = {
  access_token: "new-access",
  refresh_token: "new-refresh",
  expires_in: 1800,
};
const managers: BrowserSession[] = [];
const manager = () => {
  const result = new BrowserSession(config);
  managers.push(result);
  return result;
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
  let tail: Promise<unknown> = Promise.resolve();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, callback: () => Promise<unknown>) => {
        const current = tail.then(callback);
        tail = current.catch(() => {});
        return current;
      },
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) =>
      String(input) === "/oauth/token"
        ? Response.json(token)
        : Response.json(profile),
    ),
  );
});
afterEach(() => {
  managers.forEach((item) => item.clear(false));
  managers.length = 0;
  vi.unstubAllGlobals();
});
describe("persistent PKCE session", () => {
  it("matches the RFC 7636 S256 vector", async () =>
    expect(
      await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"));
  it("restores persistently and deduplicates refreshes within a tab", async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ refreshToken: "old-refresh", subject: "user-1" }),
    );
    const session = manager();
    expect(
      await Promise.all([session.token(), session.token(), session.token()]),
    ).toEqual(["new-access", "new-access", "new-access"]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual({
      refreshToken: "new-refresh",
      subject: "user-1",
    });
    expect(localStorage.getItem(storageKey)).not.toContain("new-access");
    expect(session.snapshot().profile?.id).toBe("user-1");
  });
  it("serializes refresh rotation across tabs without reusing a refresh token", async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ refreshToken: "initial", subject: "user-1" }),
    );
    const used: string[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input) === "/oauth/userinfo") return Response.json(profile);
      const value = new URLSearchParams(String(init?.body)).get(
        "refresh_token",
      )!;
      expect(used).not.toContain(value);
      used.push(value);
      return Response.json({
        access_token: `access-${used.length}`,
        refresh_token: `refresh-${used.length}`,
        expires_in: 1800,
      });
    });
    const first = manager(),
      second = manager();
    const result = await Promise.all([first.token(), second.token()]);
    expect(result).toHaveLength(2);
    expect(first.snapshot().phase).toBe("ready");
    expect(second.snapshot().phase).toBe("ready");
    expect(used[0]).toBe("initial");
    if (used.length > 1) expect(used[1]).toBe("refresh-1");
  });
  it("preserves a rotated refresh token if profile retrieval fails temporarily", async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ refreshToken: "old", subject: "user-1" }),
    );
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json(token))
      .mockRejectedValueOnce(new TypeError("network"));
    const session = manager();
    await expect(session.token()).rejects.toThrow();
    expect(JSON.parse(localStorage.getItem(storageKey)!).refreshToken).toBe(
      "new-refresh",
    );
  });
  it("preserves refresh on network errors and clears only on explicit rejection", async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ refreshToken: "old", subject: "user-1" }),
    );
    const session = manager();
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("network"));
    await expect(session.token()).rejects.toThrow();
    expect(localStorage.getItem(storageKey)).not.toBeNull();
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ error: "invalid_grant" }, { status: 400 }),
    );
    await expect(session.token()).rejects.toThrow();
    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(session.snapshot().phase).toBe("guest");
  });
  it("rejects callback state mismatch, expiry and duplicate parameters without exchanging", async () => {
    for (const search of [
      "?state=wrong&code=one",
      "?state=state&state=state&code=one",
    ]) {
      sessionStorage.setItem(
        "classhopper.oauth.v1",
        JSON.stringify({
          state: "state",
          verifier: "verifier",
          startedAt: Date.now(),
          returnTo: "/app/account",
        }),
      );
      await expect(manager().complete(search)).rejects.toThrow("登录校验失败");
    }
    sessionStorage.setItem(
      "classhopper.oauth.v1",
      JSON.stringify({
        state: "state",
        verifier: "verifier",
        startedAt: Date.now() - 600001,
        returnTo: "/app/account",
      }),
    );
    await expect(manager().complete("?state=state&code=one")).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("consumes callbacks once and returns to the originating course", async () => {
    sessionStorage.setItem(
      "classhopper.oauth.v1",
      JSON.stringify({
        state: "state",
        verifier: "verifier",
        startedAt: Date.now(),
        returnTo: "/app/schedule/2026-10-27/123",
      }),
    );
    const session = manager();
    expect(await session.complete("?state=state&code=one")).toBe(
      "/app/schedule/2026-10-27/123",
    );
    expect(sessionStorage.getItem("classhopper.oauth.v1")).toBeNull();
    expect(await session.complete("?state=state&code=one")).toBe(
      "/app/schedule/2026-10-27/123",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("blocks account changes and clears cached user data on logout", async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ refreshToken: "old", subject: "user-1" }),
    );
    const session = manager();
    const clear = vi.fn();
    session.onIdentityChange = clear;
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json(token))
      .mockResolvedValueOnce(Response.json({ id: "user-2" }));
    await expect(session.token()).rejects.toThrow("账号不匹配");
    expect(clear).toHaveBeenCalled();
    expect(localStorage.getItem(storageKey)).toBeNull();
  });
});
