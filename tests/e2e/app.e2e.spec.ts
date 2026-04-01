import { _electron as electron, expect, test } from "@playwright/test"
import path from "path"

test.describe("App launch", () => {
  test("app starts and renders the main window", async () => {
    const appPath = path.resolve(__dirname, "../../.vite/build/main.js")

    const app = await electron.launch({
      args: [appPath],
    })

    const window = await app.firstWindow()

    await expect(window).toHaveTitle(/Arena Oracle/)

    await app.close()
  })
})
