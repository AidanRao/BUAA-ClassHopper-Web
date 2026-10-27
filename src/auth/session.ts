import type { Profile, PublicConfig } from "@/lib/types";
import { safeReturnTo } from "@/lib/dates";
const storageKey = "classhopper.session.v1",
  transactionKey = "classhopper.oauth.v1";
interface Stored {
  refreshToken: string;
  subject: string;
}
interface Access {
  token: string;
  expiresAt: number;
  profile: Profile;
}
export interface SessionState {
  phase: "loading" | "guest" | "ready" | "error";
  profile: Profile | null;
  error: string | null;
}
interface Transaction {
  state: string;
  verifier: string;
  startedAt: number;
  returnTo: string;
}
export class SessionError extends Error {}
const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export async function pkceChallenge(verifier: string): Promise<string> {
  return base64url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
}
function stored(): Stored | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return value &&
      typeof value.refreshToken === "string" &&
      typeof value.subject === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
export class BrowserSession {
  private access: Access | null = null;
  private listeners = new Set<() => void>();
  private channel: BroadcastChannel | null =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel("classhopper-session-v1");
  private state: SessionState = {
    phase: "loading",
    profile: null,
    error: null,
  };
  private pending: Promise<string> | null = null;
  private generation = 0;
  private initialized: Promise<void> | null = null;
  private callback: Promise<string> | null = null;
  onIdentityChange: () => void = () => {};
  constructor(readonly config: PublicConfig) {
    this.channel?.addEventListener(
      "message",
      (event: MessageEvent<{ type: string; access?: Access }>) => {
        if (event.data?.type === "logout") this.clear(false);
        if (event.data?.type === "ready" && event.data.access) {
          const current = stored();
          if (current?.subject === event.data.access.profile.id)
            this.accept(event.data.access, false);
        }
      },
    );
    window.addEventListener("storage", (event) => {
      if (event.key === storageKey && event.newValue === null)
        this.clear(false);
    });
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.state;
  private publish(value: SessionState) {
    this.state = value;
    this.listeners.forEach((listener) => listener());
  }
  private accept(value: Access, broadcast = true) {
    const previous = this.state.profile?.id;
    if (previous && previous !== value.profile.id) this.onIdentityChange();
    this.access = value;
    this.publish({ phase: "ready", profile: value.profile, error: null });
    if (broadcast) this.channel?.postMessage({ type: "ready", access: value });
  }
  clear = (broadcast = true) => {
    this.generation++;
    this.access = null;
    localStorage.removeItem(storageKey);
    sessionStorage.removeItem(transactionKey);
    this.onIdentityChange();
    this.publish({ phase: "guest", profile: null, error: null });
    if (broadcast) this.channel?.postMessage({ type: "logout" });
  };
  initialize(): Promise<void> {
    if (!this.initialized) this.initialized = this.restore();
    return this.initialized;
  }
  async restore() {
    if (!stored()) {
      this.publish({ phase: "guest", profile: null, error: null });
      return;
    }
    try {
      await this.token();
    } catch (error) {
      if (stored())
        this.publish({
          phase: "error",
          profile: null,
          error: error instanceof Error ? error.message : "登录恢复失败",
        });
    }
  }
  private async exchange(
    form: URLSearchParams,
    expectedSubject?: string,
  ): Promise<string> {
    const generation = this.generation;
    const response = await fetch("/oauth/token", {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      cache: "no-store",
    });
    if (!response.ok) {
      if ([400, 401, 403].includes(response.status)) this.clear();
      throw new SessionError(
        response.status >= 500
          ? "登录服务暂时不可用，请重试"
          : "登录已失效，请重新登录",
      );
    }
    const data = (await response.json()) as {
      access_token?: unknown;
      refresh_token?: unknown;
      expires_in?: unknown;
    };
    if (
      typeof data.access_token !== "string" ||
      !data.access_token ||
      typeof data.refresh_token !== "string" ||
      !data.refresh_token ||
      typeof data.expires_in !== "number" ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in <= 0
    )
      throw new SessionError("登录服务返回无效凭据");
    if (generation !== this.generation)
      throw new SessionError("登录状态已变化");
    // Persist rotation before userinfo: a temporary profile failure must not lose the new refresh token.
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        refreshToken: data.refresh_token,
        subject: expectedSubject ?? "",
      }),
    );
    const profileResponse = await fetch("/oauth/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
      credentials: "omit",
      cache: "no-store",
    });
    if (!profileResponse.ok) {
      if ([401, 403].includes(profileResponse.status)) this.clear();
      throw new SessionError("账号资料加载失败，请重试");
    }
    const profile: Profile = await profileResponse.json();
    if (
      typeof profile.id !== "string" ||
      !profile.id ||
      (expectedSubject && profile.id !== expectedSubject)
    ) {
      this.clear();
      throw new SessionError("登录账号不匹配，请重新登录");
    }
    if (generation !== this.generation)
      throw new SessionError("登录状态已变化");
    localStorage.setItem(
      storageKey,
      JSON.stringify({ refreshToken: data.refresh_token, subject: profile.id }),
    );
    this.accept({
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000 - 30_000,
      profile,
    });
    return data.access_token;
  }
  async token(force = false): Promise<string> {
    if (!force && this.access && this.access.expiresAt > Date.now())
      return this.access.token;
    if (this.pending) return this.pending;
    const priorToken = this.access?.token;
    const refresh = async () => {
      if (
        this.access &&
        this.access.expiresAt > Date.now() &&
        (!force || this.access.token !== priorToken)
      )
        return this.access.token;
      const current = stored();
      if (!current) {
        this.clear();
        throw new SessionError("请先登录");
      }
      return this.exchange(
        new URLSearchParams({
          grant_type: "refresh_token",
          client_id: this.config.clientId,
          refresh_token: current.refreshToken,
        }),
        current.subject || undefined,
      );
    };
    if (!navigator.locks)
      throw new SessionError("请使用支持安全登录的较新版本浏览器");
    const pending = navigator.locks
      .request("classhopper-oauth-refresh", refresh)
      .then((value) => value);
    this.pending = pending;
    try {
      return await pending;
    } finally {
      this.pending = null;
    }
  }
  async begin(returnTo: string): Promise<void> {
    if (!this.config.clientId || this.config.clientId.startsWith("replace-"))
      throw new SessionError("SSO 客户端尚未配置");
    const transaction: Transaction = {
      state: random(),
      verifier: random(),
      startedAt: Date.now(),
      returnTo: safeReturnTo(returnTo),
    };
    sessionStorage.setItem(transactionKey, JSON.stringify(transaction));
    const url = new URL("/oauth/authorize", this.config.ssoIssuer);
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: `${location.origin}/oauth/callback`,
      state: transaction.state,
      code_challenge: await pkceChallenge(transaction.verifier),
      code_challenge_method: "S256",
    }).toString();
    location.assign(url);
  }
  complete(search: string): Promise<string> {
    if (!this.callback) this.callback = this.finish(search);
    return this.callback;
  }
  private async finish(search: string): Promise<string> {
    let transaction: Transaction | null = null;
    try {
      transaction = JSON.parse(
        sessionStorage.getItem(transactionKey) ?? "null",
      );
    } catch {
      /* invalid transaction */
    }
    sessionStorage.removeItem(transactionKey);
    const params = new URLSearchParams(search);
    if (
      !transaction ||
      typeof transaction.verifier !== "string" ||
      typeof transaction.state !== "string" ||
      !Number.isFinite(transaction.startedAt) ||
      Date.now() < transaction.startedAt ||
      Date.now() - transaction.startedAt > 600_000 ||
      params.getAll("state").length !== 1 ||
      params.get("state") !== transaction.state
    )
      throw new SessionError("登录校验失败或请求已过期，请重新登录");
    if (params.has("error")) throw new SessionError("SSO 登录未完成，请重试");
    if (params.getAll("code").length !== 1 || !params.get("code"))
      throw new SessionError("登录回调缺少授权码");
    if (!navigator.locks)
      throw new SessionError("请使用支持安全登录的较新版本浏览器");
    await navigator.locks.request("classhopper-oauth-refresh", () =>
      this.exchange(
        new URLSearchParams({
          grant_type: "authorization_code",
          client_id: this.config.clientId,
          redirect_uri: `${location.origin}/oauth/callback`,
          code: params.get("code")!,
          code_verifier: transaction!.verifier,
        }),
      ),
    );
    return safeReturnTo(transaction.returnTo);
  }
}
