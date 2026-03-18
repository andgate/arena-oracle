import { GameState } from "@shared/game-state-types"
import { BrowserWindow, ipcMain } from "electron"
import { gameStateEvents } from "../event-bus"
import { getGameState } from "../services/game-state-service"

export function registerGameStateIPC(win: BrowserWindow) {
  gameStateEvents.on("stateUpdated", (state: GameState) => {
    win.webContents.send("gameState:stateUpdated", state)
  })

  gameStateEvents.on("decisionRequired", (state: GameState) => {
    win.webContents.send("gameState:decisionRequired", state)
  })

  ipcMain.handle("gameState:get", () => getGameState())
}
