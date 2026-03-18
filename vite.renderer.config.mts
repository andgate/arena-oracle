import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

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
  plugins: [react(), markdownImportPlugin],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  assetsInclude: ["**/*.md"],
})
