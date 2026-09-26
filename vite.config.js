import { defineConfig } from "vite";

export default defineConfig({
  // Port default 5173
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: "dist",
  },
});
