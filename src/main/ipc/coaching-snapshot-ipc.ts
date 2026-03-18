import { BrowserWindow, ipcMain } from "electron"
import { coachingEvents } from "../event-bus"
import { getLatestSnapshot } from "../services/coaching-snapshot-service"

export function registerCoachingSnapshotIPC(win: BrowserWindow) {
  ipcMain.handle("coaching:get", () => getLatestSnapshot())
  coachingEvents.on("snapshotReady", (snapshot) => {
    win.webContents.send("coaching:snapshotReady", snapshot)
  })
}
