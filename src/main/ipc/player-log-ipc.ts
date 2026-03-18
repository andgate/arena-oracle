import { ipcMain, BrowserWindow } from "electron"
import { getAccumulatedLog } from "../services/player-log-service"
import { playerLogEvents } from "../event-bus"

export function registerPlayerLogIPC(win: BrowserWindow) {
  // Renderer can request the full accumulated log on mount
  ipcMain.handle("playerLog:getLog", () => getAccumulatedLog())

  // Forward new chunks to the renderer as they arrive
  playerLogEvents.on("chunk", (chunk) => {
    win.webContents.send("playerLog:chunk", chunk)
  })
}
