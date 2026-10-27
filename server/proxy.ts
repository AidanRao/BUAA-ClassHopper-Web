export interface ProxyConfig {
  SSO_ISSUER: string;
  SSO_CLIENT_ID: string;
  API_PLATFORM_BASE_URL: string;
}
const base = "/api/buaa-classhopper";
const response = (message: string, status: number) =>
  Response.json(
    { code: 0, msg: message, data: null },
    { status, headers: { "Cache-Control": "no-store" } },
  );
function fixedOrigin(value: string, allowLocal = false): string {
  const url = new URL(value);
  if (
    (url.protocol !== "https:" &&
      !(
        allowLocal &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error("invalid upstream origin");
  return url.origin;
}
export async function handleProxy(
  request: Request,
  env: ProxyConfig,
): Promise<Response | null> {
  const url = new URL(request.url),
    path = url.pathname;
  if (path === "/app-config") {
    if (request.method !== "GET") return response("请求方法不支持", 405);
    try {
      return Response.json(
        { ssoIssuer: fixedOrigin(env.SSO_ISSUER), clientId: env.SSO_CLIENT_ID },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return response("登录服务尚未配置", 503);
    }
  }
  const token = path === "/oauth/token",
    userinfo = path === "/oauth/userinfo";
  const anonymous = new RegExp(
    `^${base}/(?:announcement(?:/[^/]+)?|ads/slots/web-schedule-banner)$`,
  ).test(path);
  const authorization = path === `${base}/v1/iclass/authorization`;
  const schedules = path === `${base}/v1/iclass/course-schedules`;
  const signs = path === `${base}/v1/iclass/sign-ins`;
  if (!token && !userinfo && path !== "/api" && !path.startsWith("/api/"))
    return null;
  if (
    !token &&
    !userinfo &&
    !anonymous &&
    !authorization &&
    !schedules &&
    !signs
  )
    return response("接口不存在", 404);
  const allowed =
    token || signs ? ["POST"] : authorization ? ["GET", "DELETE"] : ["GET"];
  if (!allowed.includes(request.method)) return response("请求方法不支持", 405);
  if (token || signs || (authorization && request.method === "DELETE")) {
    const origin = request.headers.get("Origin");
    if (
      (origin && origin !== url.origin) ||
      request.headers.get("Sec-Fetch-Site") === "cross-site"
    )
      return response("请求来源无效", 403);
  }
  try {
    const target = new URL(
      token || userinfo ? path : path + url.search,
      fixedOrigin(
        token || userinfo ? env.SSO_ISSUER : env.API_PLATFORM_BASE_URL,
        !token && !userinfo,
      ),
    );
    const headers = new Headers({ Accept: "application/json" });
    if (!anonymous && !token && request.headers.has("Authorization"))
      headers.set("Authorization", request.headers.get("Authorization")!);
    let body: string | undefined;
    if (token || signs) {
      const chunks: Uint8Array[] = [];
      let size = 0;
      const reader = request.body?.getReader();
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 16_384) {
            await reader.cancel();
            return response("请求体过大", 413);
          }
          chunks.push(value);
        }
      }
      body = new TextDecoder().decode(
        Uint8Array.from(chunks.flatMap((chunk) => [...chunk])),
      );
      headers.set(
        "Content-Type",
        token ? "application/x-www-form-urlencoded" : "application/json",
      );
      if (token) {
        const input = new URLSearchParams(body);
        const grant = input.get("grant_type");
        const common = ["grant_type", "client_id"];
        const fields =
          grant === "authorization_code"
            ? [...common, "redirect_uri", "code", "code_verifier"]
            : grant === "refresh_token"
              ? [...common, "refresh_token"]
              : [];
        if (
          !fields.length ||
          input.get("client_id") !== env.SSO_CLIENT_ID ||
          [...input.keys()].some(
            (key) => !fields.includes(key) || input.getAll(key).length !== 1,
          ) ||
          fields.some((key) => !input.get(key))
        )
          return response("授权请求无效", 400);
        if (
          grant === "authorization_code" &&
          input.get("redirect_uri") !== `${url.origin}/oauth/callback`
        )
          return response("回调地址不匹配", 400);
      }
    }
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(35_000),
    });
    if (upstream.status >= 300 && upstream.status < 400)
      return response("上游返回无效跳转", 502);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return response("服务连接失败，请稍后重试", 502);
  }
}
