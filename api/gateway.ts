import { handleProxy } from "../server/proxy.js";
import { proxyConfig } from "../server/config.js";

async function gateway(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const paths = url.searchParams.getAll("__path");
  const path = paths[0];
  if (
    paths.length !== 1 ||
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[\\?#\u0000-\u0020]/.test(path)
  ) {
    return Response.json(
      { code: 0, msg: "接口不存在", data: null },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (url.pathname !== "/api/gateway" && url.pathname !== path) {
    return Response.json(
      { code: 0, msg: "请求路径无效", data: null },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  url.pathname = path;
  url.searchParams.delete("__path");
  const response = await handleProxy(
    new Request(url, request),
    proxyConfig(process.env, process.env.VERCEL_ENV === "development"),
  );
  return (
    response ??
    Response.json(
      { code: 0, msg: "接口不存在", data: null },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    )
  );
}

export {
  gateway as GET,
  gateway as POST,
  gateway as DELETE,
  gateway as PUT,
  gateway as PATCH,
  gateway as OPTIONS,
  gateway as HEAD,
};
