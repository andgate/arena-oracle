import { ipcMain } from "electron"
import { ICardDbService } from "../services/card-db/CardDbService.interface"
import { container } from "../services/container"

export function registerCardDbIPC() {
  const cardDb = container.resolve<ICardDbService>(ICardDbService)
  ipcMain.handle("cardDb:isLoaded", () => cardDb.isLoaded())
  ipcMain.handle("cardDb:lookupCard", (_event, grpId: number) =>
    cardDb.lookupCard(grpId),
  )
}
