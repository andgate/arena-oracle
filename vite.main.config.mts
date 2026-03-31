import path from "path"
import { defineConfig } from "vite"

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      "@main": path.resolve(__dirname, "src/main"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  build: {
    rollupOptions: {
      external: ["better-sqlite3"],
    },
  },
})
