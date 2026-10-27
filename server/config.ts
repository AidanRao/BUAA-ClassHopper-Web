import type { ProxyConfig } from "./proxy.js";
export function proxyConfig(
  values: Record<string, string | undefined>,
  development = false,
): ProxyConfig {
  return {
    SSO_ISSUER:
      values.SSO_ISSUER ??
      (development
        ? "https://sso-test.aidanrao.top"
        : "https://sso.aidanrao.top"),
    SSO_CLIENT_ID: values.SSO_CLIENT_ID ?? "",
    API_PLATFORM_BASE_URL:
      values.API_PLATFORM_BASE_URL ??
      (development
        ? "http://127.0.0.1:5173"
        : "https://api-platform.aidanrao.top"),
  };
}
