import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Deliberately omits vite-plugin-pwa so the service worker is not generated during tests.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
