import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { proxyConfig } from "./server/config.ts";
import { localProxy } from "./server/local-proxy.ts";
import { securityHeaders } from "./server/security.ts";
export default defineConfig(({ mode }) => {
  const config = proxyConfig(
    { ...loadEnv(mode, process.cwd(), ""), ...process.env },
    mode === "development",
  );
  const proxy: Plugin = {
    name: "classhopper-local-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void localProxy(req, res, next, config);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void localProxy(req, res, next, config);
      });
    },
  };
  return {
    plugins: [react(), tailwindcss(), proxy],
    resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
    server: { host: "127.0.0.1", port: 5180, strictPort: true },
    preview: {
      host: "127.0.0.1",
      port: 5181,
      strictPort: true,
      headers: securityHeaders,
    },
  };
});
