import type { IncomingMessage, ServerResponse } from "node:http";
import { handleProxy, type ProxyConfig } from "./proxy.js";

export async function localProxy(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  config: ProxyConfig,
) {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "127.0.0.1:5180"}`,
  );
  if (!(
    url.pathname === "/app-config" ||
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/") ||
    ["/oauth/token", "/oauth/userinfo"].includes(url.pathname)
  ))
    return next();
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16_384) {
        res.writeHead(413, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify({ code: 0, msg: "请求体过大", data: null }));
        return;
      }
      chunks.push(Buffer.from(chunk));
    }
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value !== undefined)
        headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    });
    const method = req.method ?? "GET";
    const request = new Request(url, {
      method,
      headers,
      ...(["GET", "HEAD"].includes(method)
        ? {}
        : { body: Buffer.concat(chunks) }),
    });
    const response = await handleProxy(request, config);
    if (!response) return next();
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (method === "HEAD") {
      await response.body?.cancel();
      res.end();
      return;
    }
    // Preserve streaming backpressure for upstream responses.
    const reader = response.body?.getReader();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.write(value))
          await new Promise<void>((resolve) => res.once("drain", resolve));
      }
    }
    res.end();
  } catch {
    if (!res.headersSent)
      res.writeHead(502, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
    res.end(
      JSON.stringify({ code: 0, msg: "服务连接失败，请稍后重试", data: null }),
    );
  }
}
