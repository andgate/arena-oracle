import { ipcMain } from "electron"
import { isCardDbLoaded, lookupCard } from "../services/card-db-service"

export function registerCardDbIPC() {
  ipcMain.handle("cardDb:isLoaded", () => isCardDbLoaded())
  ipcMain.handle(
    "cardDb:lookupCard",
    (_event, grpId: number) => lookupCard(grpId) ?? null,
  )
}
