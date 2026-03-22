import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    projects: [
      {
        test: {
          name: "main",
          environment: "node",
          include: [
            "src/main/**/*.{test,spec}.{js,ts}",
            "src/shared/**/*.{test,spec}.{js,ts}",
          ],
        },
      },
      {
        test: {
          name: "renderer",
          environment: "happy-dom",
          include: ["src/renderer/**/*.{test,spec}.{js,ts,tsx,jsx}"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
