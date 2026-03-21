import "reflect-metadata"
import { app, BrowserWindow } from "electron"
import path from "node:path"
import started from "electron-squirrel-startup"
import { registerGameStateIPC } from "./ipc/game-state-ipc"
import { registerCardDbIPC } from "./ipc/card-db-ipc"
import { registerCoachingSnapshotIPC } from "./ipc/coaching-snapshot-ipc"
import { startPipeline } from "./service-orchestrator"
import { registerStreams } from "./ipc/register-streams"

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string
declare const MAIN_WINDOW_VITE_NAME: string

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit()
}

const createWindow = (): BrowserWindow => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  })

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    )
  }

  // Open DevTools
  mainWindow.webContents.openDevTools()

  return mainWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  const win = createWindow()

  // Start the pipeline
  startPipeline()

  // Register IPC streams
  registerStreams(win)

  // Register our IPC services
  registerGameStateIPC(win)
  registerCardDbIPC()
  registerCoachingSnapshotIPC(win)
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
