import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, useNavigate } from "react-router";
import { Analytics } from "@aidanrao/event-analytics";
import { AnalyticsRouteTracker } from "../src/components/analytics-route-tracker";
import { BrowserSession } from "../src/auth/session";
import { analyticsEndpoint, createAnalytics, type WebAnalytics } from "../src/lib/analytics";
import { version } from "../package.json";
import { securityHeaders } from "../server/security";
import vercelConfig from "../vercel.json";

interface Batch {
  context: { app_id: string; app_version: string; platform: string; session_id: string };
  identity: { user_id: string; web_id: string; anonymous_id: string };
  events: { event_name: string; properties: Record<string, unknown> }[];
}
const reporters: WebAnalytics[] = [];
const batches: Batch[] = [];
const channels: EventTarget[] = [];
const create = () => {
  const reporter = createAnalytics("classhopper-web-test")!;
  reporters.push(reporter);
  return reporter;
};
const events = () => batches.flatMap((batch) => batch.events);
const clicks = () => batches.flatMap((batch) => batch.events
  .filter((event) => event.event_name === "element_click")
  .map((event) => ({ ...event, identity: batch.identity, context: batch.context })));
function click(id: string) {
  const button = document.createElement("button");
  button.dataset.analyticsId = id;
  button.textContent = "Private student name";
  document.body.append(button);
  button.click();
  button.remove();
}
function globalError(message: string) {
  // Mark this deliberate fixture as handled for Vitest's window error bridge.
  const handled = () => {};
  window.addEventListener("error", handled);
  try {
    window.dispatchEvent(new ErrorEvent("error", { error: new Error(message) }));
  } finally {
    window.removeEventListener("error", handled);
  }
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState(null, "", "/");
  batches.length = 0;
  channels.length = 0;
  vi.stubGlobal("BroadcastChannel", class extends EventTarget {
    constructor() { super(); channels.push(this); }
    postMessage() {}
    close() {}
  });
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input) === analyticsEndpoint) {
      batches.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 202 });
    }
    if (String(input) === "/oauth/token")
      return Response.json({ access_token: "secret-access", refresh_token: "secret-refresh", expires_in: 1800 });
    if (String(input) === "/oauth/userinfo")
      return Response.json({ id: "user-1", name: "Private student name", email: "private@example.com" });
    throw new Error(`Unexpected request: ${input}`);
  }));
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: { request: (_name: string, callback: () => Promise<unknown>) => callback() },
  });
});
afterEach(async () => {
  cleanup();
  for (const reporter of reporters) {
    reporter.visit("/privacy-and-terms");
    await reporter.flush();
    reporter.dispose();
  }
  reporters.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Web analytics integration with the installed SDK", () => {
  it.each([undefined, "", "bad id", "a".repeat(65), "中文"])("disables invalid app ID %s without requests or storage", (appId) => {
    expect(createAnalytics(appId)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("sends only the configured automatic events and stable identifiers", async () => {
    const reporter = create();
    history.replaceState(null, "", "/app/schedule/2026-10-31?code=secret-code&state=secret-state#secret-hash");
    reporter.visit(location.pathname);
    const input = document.createElement("input");
    input.value = "secret-form-value";
    input.dataset.analyticsId = "date-input";
    document.body.append(input);
    input.click();
    input.remove();
    click("open-course");
    reporter.captureError(new Error("Example render failure"));
    reporter.visit("/app/schedule/2026-11-01");
    await reporter.flush();

    const views = events().filter((event) => event.event_name === "page_view");
    expect(views).toHaveLength(2);
    expect(views.map((event) => event.properties.page_id)).toEqual(["schedule", "schedule"]);
    expect(views[0].properties.page_url).toBe("/app/schedule/2026-10-31");
    expect(events().some((event) => event.event_name === "page_leave")).toBe(true);
    expect(events().some((event) => event.event_name === "js_error")).toBe(true);
    expect(clicks().map((event) => event.properties.element_id)).toEqual(["date-input", "open-course"]);
    expect([...new Set(events().map((event) => event.event_name))].sort()).toEqual(["element_click", "js_error", "page_leave", "page_view"]);
    expect(batches[0].context).toMatchObject({ app_id: "classhopper-web-test", app_version: version, platform: "web" });
    expect(batches[0].identity.anonymous_id).toBeTruthy();
    expect(batches[0].identity.web_id).toBe(batches[0].identity.anonymous_id);
    expect(batches[0].identity.user_id).toBe(batches[0].identity.web_id);
    expect(batches[0].context.session_id).toBeTruthy();
    const payload = JSON.stringify(batches);
    for (const value of ["secret-code", "secret-state", "secret-hash", "secret-form-value", "Private student name"])
      expect(payload).not.toContain(value);
    for (const [url, init] of vi.mocked(fetch).mock.calls) {
      expect(url).toBe(analyticsEndpoint);
      expect(init).toMatchObject({ method: "POST", credentials: "omit" });
      expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    }
  });

  it("keeps excluded routes free of PV, clicks, errors and anonymous storage on initial load", async () => {
    const reporter = create();
    for (const path of ["/privacy-and-terms", "/privacy-and-terms/", "/oauth/callback", "/app", "/app/schedule"]) {
      history.replaceState(null, "", path);
      reporter.visit(path);
      click("excluded");
      reporter.captureError(new Error("Excluded error"));
      globalError("Excluded global error");
    }
    await reporter.flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("stops collectors on excluded routes and resumes after callback navigation", async () => {
    const reporter = create();
    reporter.visit("/app/account");
    await reporter.flush();
    for (const path of ["/privacy-and-terms", "/oauth/callback"]) {
      history.replaceState(null, "", path + "?code=secret");
      reporter.visit(path);
      await reporter.flush();
      batches.length = 0;
      click("excluded");
      globalError("Excluded global error");
      reporter.captureError(new Error("Excluded render error"));
      await reporter.flush();
      expect(events()).toEqual([]);
    }
    history.replaceState(null, "", "/app/account");
    reporter.visit(location.pathname);
    click("included");
    await reporter.flush();
    expect(events().map((event) => event.event_name)).toEqual(["page_view", "element_click"]);
  });

  it("tracks committed navigation once in StrictMode, including back and forward; local sheets do not add PV", async () => {
    const reporter = create();
    function Controls() {
      const navigate = useNavigate();
      const [sheet, setSheet] = useState(false);
      return <>
        <Link to="/app/schedule/2026-11-01?token=secret">Next day</Link>
        <button onClick={() => navigate(-1)}>Back</button>
        <button onClick={() => navigate(1)}>Forward</button>
        <button onClick={() => setSheet(!sheet)}>Toggle sheet</button>
        {sheet && <div role="dialog">Course</div>}
      </>;
    }
    render(<StrictMode><MemoryRouter initialEntries={["/app/schedule/2026-10-31"]}>
      <AnalyticsRouteTracker reporter={reporter} />
      <Controls />
    </MemoryRouter></StrictMode>);
    await reporter.flush();
    expect(events().filter((event) => event.event_name === "page_view")).toHaveLength(1);
    fireEvent.click(screen.getByText("Toggle sheet"));
    fireEvent.click(screen.getByText("Toggle sheet"));
    await reporter.flush();
    expect(events().filter((event) => event.event_name === "page_view")).toHaveLength(1);
    fireEvent.click(screen.getByText("Next day"));
    fireEvent.click(screen.getByText("Back"));
    fireEvent.click(screen.getByText("Forward"));
    await reporter.flush();
    expect(events().filter((event) => event.event_name === "page_view").map((event) => event.properties.page_url))
      .toEqual(["/app/schedule/2026-10-31", "/app/schedule/2026-11-01", "/app/schedule/2026-10-31", "/app/schedule/2026-11-01"]);
  });

  it("finishes the previous page duration when navigating to an excluded route", async () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(100);
    const reporter = create();
    history.replaceState(null, "", "/app/account");
    reporter.visit(location.pathname);
    now.mockReturnValue(250);
    history.replaceState(null, "", "/privacy-and-terms");
    reporter.visit(location.pathname);
    click("excluded");
    await reporter.flush();
    expect(events().map((event) => event.event_name)).toEqual(["page_view", "page_leave"]);
    expect(events()[1].properties).toMatchObject({ page_url: "/app/account", duration_ms: 150 });
  });

  it("snapshots SSO identity and returns to the same web ID after cross-tab logout or expiry", async () => {
    const reporter = create();
    const session = new BrowserSession({ ssoIssuer: "https://sso.example.com", clientId: "classhopper" });
    reporter.bindSession(session);
    reporter.visit("/app/account");
    click("before-login");
    localStorage.setItem("classhopper.session.v1", JSON.stringify({ subject: "user-1", refreshToken: "old-refresh" }));
    await session.initialize();
    click("after-login");
    localStorage.setItem("classhopper.session.v1", JSON.stringify({ subject: "user-2", refreshToken: "other-refresh" }));
    channels[0].dispatchEvent(new MessageEvent("message", { data: {
      type: "ready",
      access: { token: "other-access", expiresAt: Date.now() + 60000, profile: { id: "user-2" } },
    } }));
    click("after-switch");
    channels[0].dispatchEvent(new MessageEvent("message", { data: { type: "logout" } }));
    click("after-broadcast-logout");
    localStorage.setItem("classhopper.session.v1", JSON.stringify({ subject: "user-1", refreshToken: "old-refresh" }));
    await session.token();
    window.dispatchEvent(new StorageEvent("storage", { key: "classhopper.session.v1", newValue: null }));
    click("after-storage-logout");
    localStorage.setItem("classhopper.session.v1", JSON.stringify({ subject: "user-1", refreshToken: "old-refresh" }));
    await session.token();
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: "invalid_grant" }, { status: 400 }));
    await expect(session.token(true)).rejects.toThrow();
    click("after-expiry");
    await reporter.flush();
    const webId = clicks()[0].identity.web_id;
    expect(clicks().map((event) => [event.properties.element_id, event.identity.user_id]))
      .toEqual([["before-login", webId], ["after-login", "user-1"], ["after-switch", "user-2"],
        ["after-broadcast-logout", webId], ["after-storage-logout", webId], ["after-expiry", webId]]);
    expect(new Set(clicks().map((event) => event.identity.web_id))).toEqual(new Set([webId]));
    expect(clicks().every((event) => event.identity.anonymous_id === webId)).toBe(true);
    expect(new Set(clicks().map((event) => event.identity.anonymous_id)).size).toBe(1);
    expect(new Set(clicks().map((event) => event.context.session_id)).size).toBe(1);
    for (const value of ["secret-access", "secret-refresh", "Private student name", "private@example.com", "other-access"])
      expect(JSON.stringify(batches)).not.toContain(value);
  });

  it("restores the web ID synchronously before leaving for SSO logout", async () => {
    const reporter = create();
    const session = new BrowserSession({ ssoIssuer: "https://sso.example.com", clientId: "classhopper" });
    reporter.bindSession(session);
    reporter.visit("/app/account");
    localStorage.setItem("classhopper.session.v1", JSON.stringify({ subject: "user-1", refreshToken: "old-refresh" }));
    await session.token();
    const assign = vi.fn(() => click("leaving-logout"));
    vi.stubGlobal("location", { origin: location.origin, pathname: "/app/account", assign });
    session.logout();
    await reporter.flush();
    expect(assign).toHaveBeenCalledWith("https://sso.example.com/logout");
    const identity = clicks().at(-1)!.identity;
    expect(identity.user_id).toBe(identity.web_id);
    expect(identity.user_id).not.toBe("user-1");
  });

  it("persists the browser ID across document restarts and isolates app IDs", async () => {
    const first = create();
    first.visit("/");
    await first.flush();
    const webId = batches[0].identity.web_id;
    first.visit("/privacy-and-terms");
    await first.flush();
    first.dispose();
    const restarted = create();
    restarted.visit("/");
    await restarted.flush();
    expect(batches.at(-1)!.identity).toEqual({ user_id: webId, web_id: webId, anonymous_id: webId });
    const anotherApp = createAnalytics("another-app")!;
    reporters.push(anotherApp);
    anotherApp.visit("/");
    await anotherApp.flush();
    expect(batches.at(-1)!.identity.web_id).not.toBe(webId);
    expect(batches.at(-1)!.context.app_id).toBe("another-app");
  });

  it.each(["cleared", "corrupt"])("replaces %s browser identity storage on the next document", async (mode) => {
    const first = create();
    first.visit("/");
    await first.flush();
    const oldId = batches[0].identity.web_id;
    const key = Object.keys(localStorage).find((key) => key.startsWith("classhopper.analytics:"))!;
    first.visit("/privacy-and-terms");
    await first.flush();
    first.dispose();
    if (mode === "cleared") localStorage.clear();
    else localStorage.setItem(key, "corrupt-browser-id");
    const next = create();
    next.visit("/");
    await next.flush();
    const identity = batches.at(-1)!.identity;
    expect(identity.web_id).not.toBe(oldId);
    expect(identity.web_id).not.toBe("corrupt-browser-id");
    expect(identity.user_id).toBe(identity.web_id);
    expect(localStorage.getItem(key)).toBe(identity.web_id);
  });

  it("retains one in-memory web ID when browser storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("storage unavailable"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage unavailable"); });
    const reporter = create();
    reporter.visit("/");
    click("first");
    reporter.visit("/app/account");
    click("second");
    await reporter.flush();
    const identities = batches.map((batch) => batch.identity);
    expect(identities[0].web_id).toBeTruthy();
    expect(new Set(identities.map((identity) => identity.web_id)).size).toBe(1);
    expect(identities.every((identity) => identity.user_id === identity.web_id)).toBe(true);
    expect(localStorage.length).toBe(0);
  });

  it("uses an already verified account for the first event without converting long IDs to numbers", async () => {
    const reporter = create();
    const accountId = "9007199254740993123";
    reporter.bindSession({
      snapshot: () => ({ phase: "ready", profile: { id: accountId }, error: null }),
      subscribe: () => () => {},
    });
    expect(localStorage.length).toBe(0);
    reporter.visit("/app/account");
    await reporter.flush();
    expect(batches[0].identity.user_id).toBe(accountId);
    expect(batches[0].identity.web_id).not.toBe(accountId);
    expect(batches[0].identity.web_id).toBe(batches[0].identity.anonymous_id);
  });

  it("captures render failures before the first route effect commits", async () => {
    const reporter = create();
    history.replaceState(null, "", "/app/account");
    reporter.captureError(new Error("Initial render failed"));
    await reporter.flush();
    expect(events().map((event) => event.event_name)).toEqual(["page_view", "js_error"]);
    expect(events()[1].properties.message).toBe("Initial render failed");
  });

  it("contains collector startup failures and delivery rejection", async () => {
    const reporter = create();
    vi.spyOn(Analytics.prototype, "startAutoTracking").mockImplementationOnce(() => { throw new Error("unsupported browser"); });
    expect(() => reporter.visit("/app/account")).not.toThrow();
    expect(() => reporter.visit("/app/account")).not.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    const active = create();
    active.visit("/app/account");
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(active.flush()).resolves.toBeUndefined();
    click("still-interactive");
    await active.flush();
    expect(clicks().at(-1)?.properties.element_id).toBe("still-interactive");
  });

  it("keeps the preview and Vercel CSP identical and precisely permits ingestion", () => {
    const csp = securityHeaders["Content-Security-Policy"];
    const deployed = vercelConfig.headers[0].headers.find((header) => header.key === "Content-Security-Policy")?.value;
    expect(deployed).toBe(csp);
    expect(csp.split(";").find((directive) => directive.trim().startsWith("connect-src"))?.trim())
      .toBe("connect-src 'self' https://events.aidanrao.top");
  });
});
