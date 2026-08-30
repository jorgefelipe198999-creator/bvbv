import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: false,
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
      strictPort: false,
    },
  },

  tanstackStart: {
    server: { entry: "server" },
  },

  nitro: {
    preset: "node-server",
  },
});
