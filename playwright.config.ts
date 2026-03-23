import { defineConfig } from "@playwright/test"
import path from "path"

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests/e2e/",
  testMatch: "**/*.e2e.{test,spec}.{ts,tsx}",
  fullyParallel: false, // Electron apps share one instance
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  workers: 1, // No parallel work allowed
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["html", { open: "never" }]],
  timeout: 30_000,
  use: {
    // Ensures Playwright resolves paths relative to project root
    baseURL: path.resolve(__dirname),
  },
})
