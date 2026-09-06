import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxies /api/* to the backend (mock server during Phase 4, real FastAPI
// app after Phase 5 swaps it in — this file does not need to change).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
