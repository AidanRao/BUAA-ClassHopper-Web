import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { BrowserSession } from "./auth/session";
import { SessionContext } from "./auth/context";
import { HomePage } from "./pages/home";
import { PrivacyAndTermsPage } from "./pages/privacy-and-terms";
import type { PublicConfig } from "./lib/types";
import "./styles.css";
const root = createRoot(document.getElementById("root")!);
async function start() {
  const response = await fetch("/app-config", {
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("站点配置加载失败，请刷新重试");
  const config: PublicConfig = await response.json();
  if (
    typeof config.ssoIssuer !== "string" ||
    typeof config.clientId !== "string"
  )
    throw new Error("站点配置无效");
  const session = new BrowserSession(config);
  const queries = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
  });
  session.onIdentityChange = () => {
    void queries.cancelQueries({ queryKey: ["private"] });
    queries.removeQueries({ queryKey: ["private"] });
  };
  if (location.pathname !== "/oauth/callback") void session.initialize();
  root.render(
    <StrictMode>
      <QueryClientProvider client={queries}>
        <SessionContext.Provider value={session}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SessionContext.Provider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
if (location.pathname === "/") {
  root.render(<HomePage />);
} else if (/^\/privacy-and-terms\/?$/.test(location.pathname)) {
  root.render(<PrivacyAndTermsPage />);
} else {
  void start().catch((error: unknown) =>
    root.render(
      <div className="message">
        <h1 className="text-lg">暂时无法打开</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "请刷新页面重试"}
        </p>
        <button
          className="mt-5 text-sm text-primary"
          onClick={() => location.reload()}
        >
          刷新页面
        </button>
      </div>,
    ),
  );
}
