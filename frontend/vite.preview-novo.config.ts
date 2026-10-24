import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Só para conferir o visual novo: `npx vite build --config vite.preview-novo.config.ts --outDir <pasta>`. */
export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: "preview-novo.html" } },
});
