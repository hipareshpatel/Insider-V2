import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "app",
  plugins: [react()],
  build: { outDir: "../site", emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 400 },
});
