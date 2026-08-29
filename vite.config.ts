// @lovable.dev/vite-tanstack-config already includes standard plugins.
// We pass Tauri-specific settings into the vite override object.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// process is a nodejs global (types pulled in via vite's type references)
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  vite: {
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host ? { protocol: "ws", host, port: 1421 } : false,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
    },
  },
});
