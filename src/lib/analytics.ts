import { Analytics, type JsonObject } from "@aidanrao/event-analytics";
import { version } from "../../package.json";
import type { BrowserSession } from "@/auth/session";

export const analyticsEndpoint = "https://events.aidanrao.top/v1/events";

function pageForPath(path: string) {
  if (path === "/") return { pageId: "home", pageName: "首页" };
  if (/^\/app\/schedule\/\d{4}-\d{2}-\d{2}\/?$/.test(path))
    return { pageId: "schedule", pageName: "课表" };
  if (/^\/app\/announcements\/[^/]+\/?$/.test(path))
    return { pageId: "announcement", pageName: "公告详情" };
  if (/^\/app\/announcements\/?$/.test(path))
    return { pageId: "announcements", pageName: "公告" };
  if (/^\/app\/account\/?$/.test(path))
    return { pageId: "account", pageName: "我的" };
  if (/^\/app\/login\/?$/.test(path))
    return { pageId: "login", pageName: "登录" };
  // Redirect-only entry routes do not represent an additional page visit.
  if (/^\/app(?:\/schedule)?\/?$/.test(path)) return null;
  if (path.startsWith("/app/"))
    return { pageId: "not_found", pageName: "页面不存在" };
  return null;
}

export class WebAnalytics {
  private readonly sdk: Analytics;
  private readonly releaseRoute: () => void;
  private readonly webIdStorageKey: string;
  private readonly subscriptions = new Set<() => void>();
  private webId: string | null = null;
  private subject: string | null = null;
  private pathname = "";
  private enabled = true;

  constructor(appId: string) {
    this.webIdStorageKey = `classhopper.analytics:${encodeURIComponent(analyticsEndpoint)}:${appId}:web-id`;
    this.sdk = new Analytics({
      endpoint: analyticsEndpoint,
      appId,
      appVersion: version,
    });
    // React owns committed routes, including the standalone homepage.
    this.releaseRoute = this.sdk.bindPageTracking();
  }

  private safely(action: () => void) {
    if (!this.enabled) return;
    try {
      action();
    } catch {
      this.dispose();
    }
  }

  private updateIdentity() {
    if (!this.webId) return;
    this.sdk.setIdentity({
      user_id: this.subject ?? this.webId,
      web_id: this.webId,
      // Preserve the SDK field without creating a second browser identifier.
      anonymous_id: this.webId,
    });
  }

  private ensureWebId() {
    if (this.webId) return;
    try {
      const saved = localStorage.getItem(this.webIdStorageKey);
      if (saved && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(saved))
        this.webId = saved;
    } catch {
      // Storage restrictions leave the identifier scoped to this document.
    }
    if (!this.webId) {
      this.webId = crypto.randomUUID();
      try {
        localStorage.setItem(this.webIdStorageKey, this.webId);
      } catch {
        // Keep using the same in-memory ID until the document is closed.
      }
    }
  }

  visit(pathname: string) {
    this.safely(() => {
      const page = pageForPath(pathname);
      if (!page) {
        this.sdk.stopAutoTracking();
        this.pathname = pathname;
        return;
      }
      this.pathname = pathname;
      this.ensureWebId();
      this.updateIdentity();
      this.sdk.startAutoTracking({
        clicks: true,
        anonymousIdentity: false,
        queryAllowlist: [],
        // Finish the previous tracked page, but ignore new activity on excluded routes.
        beforeTrack: (event) =>
          event.name === "page_leave" ||
          (pageForPath(this.pathname) && pageForPath(window.location.pathname))
            ? event
            : null,
      });
      this.sdk.trackPageView({
        ...page,
        url: new URL(pathname, window.location.origin).href,
        reason: "navigation",
      });
    });
  }

  bindSession(session: Pick<BrowserSession, "snapshot" | "subscribe">) {
    const sync = () => {
      this.safely(() => {
        const state = session.snapshot();
        this.subject = state.phase === "ready" && state.profile?.id
          ? state.profile.id
          : null;
        this.updateIdentity();
      });
    };
    sync();
    const unsubscribe = session.subscribe(sync);
    this.subscriptions.add(unsubscribe);
    return () => {
      this.subscriptions.delete(unsubscribe);
      unsubscribe();
    };
  }

  captureError(error: unknown, extra: JsonObject = {}) {
    if (!pageForPath(window.location.pathname)) return;
    // A failed initial render may never commit the route tracker's effect.
    if (!this.sdk.isAutoTracking) this.visit(window.location.pathname);
    this.safely(() => this.sdk.captureError(error, "react", extra));
  }

  async flush() {
    if (!this.enabled) return;
    try {
      await this.sdk.flush();
    } catch {
      this.dispose();
    }
  }

  dispose() {
    if (!this.enabled) return;
    this.enabled = false;
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.subscriptions.clear();
    this.releaseRoute();
    try {
      void this.sdk.close().catch(() => {});
    } catch {
      // Even cleanup failures must stay outside the application's error path.
    }
  }
}

export function createAnalytics(appId: string | undefined): WebAnalytics | null {
  if (!appId || !/^[A-Za-z0-9_-]{1,64}$/.test(appId)) return null;
  try {
    return new WebAnalytics(appId);
  } catch {
    return null;
  }
}

// One instance per document; React StrictMode does not own its lifetime.
export const analytics = createAnalytics(import.meta.env.VITE_ANALYTICS_APP_ID);
if (import.meta.hot) import.meta.hot.dispose(() => analytics?.dispose());
