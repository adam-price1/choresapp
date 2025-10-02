import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // During dev, you can proxy API to avoid CORS if you want.
  // If you prefer direct calls, just ignore the server.proxy section.
  const api = env.VITE_API_URL || "";

  return {
    plugins: [react()],
    server: api
      ? {
          proxy: {
            "/api": {
              target: api,
              changeOrigin: true,
            },
          },
        }
      : undefined,
    build: {
      outDir: "dist",
      sourcemap: false,
    },
  };
});
