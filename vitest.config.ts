import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // Test files
        "src/**/*.{test,spec}.{ts,tsx}",
        // Interface files
        "**/*.interface.ts",
        // Declaration files
        "**/*.d.ts",
        // Mock files
        "**/Mock*.{ts,tsx}",
        // DI wiring & symbol declarations
        "**/main/services/container.ts",
        "**/main/services/lifecycle.ts",
        "**/main/utils/fs/FileSystem.ts",
        // Entry points & IPC wiring
        "**/main/main.ts",
        "**/main/ipc/**",
        "**/preload/preload.ts",
        // Renderer entry points & untestable hooks
        "**/renderer/components/**",
        "**/renderer/components/ui/**",
        "**/renderer/hooks/**",
        "**/renderer/app/**",
        "**/renderer/lib/**",
        "**/renderer/index.ts",
        "**/renderer/streams.ts",
      ],
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
          setupFiles: ["tests/main/setup.ts"],
          include: [
            "src/main/**/*.{test,spec}.{js,ts}",
            "src/shared/**/*.{test,spec}.{js,ts}",
            "tests/main/**/*.{test,spec}.{js,ts}",
          ],
        },
        resolve: {
          alias: {
            "@shared": path.resolve(__dirname, "./src/shared"),
            "@main": path.resolve(__dirname, "./src/main"),
            "@tests": path.resolve(__dirname, "./tests"),
          },
        },
      },
      {
        test: {
          name: "renderer",
          environment: "happy-dom",
          include: [
            "src/renderer/**/*.{test,spec}.{js,ts,tsx,jsx}",
            "src/shared/**/*.{test,spec}.{js,ts}",
            "tests/renderer/**/*.{test,spec}.{js,ts}",
          ],
        },
        resolve: {
          alias: {
            "@shared": path.resolve(__dirname, "./src/shared"),
            "@renderer": path.resolve(__dirname, "./src/renderer"),
            "@tests": path.resolve(__dirname, "./tests"),
          },
        },
      },
      {
        test: {
          name: "shared",
          environment: "node",
          include: [
            "src/shared/**/*.{test,spec}.{js,ts}",
            "tests/shared/**/*.{test,spec}.{js,ts}",
          ],
        },
        resolve: {
          alias: {
            "@shared": path.resolve(__dirname, "./src/shared"),
            "@tests": path.resolve(__dirname, "./tests"),
          },
        },
      },
    ],
  },
})
