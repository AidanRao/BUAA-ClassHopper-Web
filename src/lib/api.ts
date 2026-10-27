import type { BrowserSession } from "@/auth/session";
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason?: string,
  ) {
    super(message);
  }
}
export const apiBase = "/api/buaa-classhopper";
export async function api<T>(
  path: string,
  session?: BrowserSession,
  options: RequestInit = {},
): Promise<T> {
  const send = async (force = false) => {
    const headers = new Headers(options.headers);
    if (options.body) headers.set("Content-Type", "application/json");
    if (session)
      headers.set("Authorization", `Bearer ${await session.token(force)}`);
    return fetch(`${apiBase}${path}`, {
      ...options,
      headers,
      credentials: "omit",
      cache: "no-store",
    });
  };
  let response = await send();
  // GETs may safely retry authentication once. Never automatically replay sign-in POSTs.
  if (
    response.status === 401 &&
    session &&
    (!options.method || options.method === "GET")
  )
    response = await send(true);
  if (response.status === 401 && session) {
    session.clear();
    throw new ApiError("登录已失效，请重新登录", 401);
  }
  let body: { code: number; msg: string; data: T & { reason?: string } };
  try {
    body = await response.json();
  } catch {
    throw new ApiError("服务返回无效数据", response.status);
  }
  if (
    !body ||
    typeof body !== "object" ||
    ![0, 1].includes(body.code) ||
    !("data" in body)
  ) {
    throw new ApiError("服务返回无效数据", response.status);
  }
  if (!response.ok || body.code !== 1)
    throw new ApiError(
      body.msg || "请求失败，请重试",
      response.status,
      body.data?.reason,
    );
  return body.data;
}
export function httpUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
