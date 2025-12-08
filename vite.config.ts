import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "src/app",
  build: {
    outDir: "../../dist/public",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/app/index.html"),
        view: resolve(__dirname, "src/app/view.html"),
      },
    },
  },
});
