import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "path"
import { defineConfig } from "vite"

const markdownImportPlugin = {
  name: "markdown-as-string",
  transform(src: any, id: any) {
    if (id.endsWith(".md")) {
      // Escape content properly for JS string
      const escaped = JSON.stringify(src)
      return {
        code: `export default ${escaped}`,
        map: null,
      }
    }
  },
}

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react(), tailwindcss(), markdownImportPlugin],
  resolve: {
    alias: {
      "@renderer": path.resolve(__dirname, "../src/renderer"),
      "@shared": path.resolve(__dirname, "../src/shared"),
    },
  },
  assetsInclude: ["**/*.md"],
})
