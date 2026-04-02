import { ipcMain } from "electron"
import { container } from "../services/container"
import { ISettingsService } from "../services/settings/SettingsService.interface"

export function registerSettingsIPC() {
  const settingsService = container.resolve<ISettingsService>(ISettingsService)

  ipcMain.handle("settings:get", () => settingsService.get())
  ipcMain.handle("settings:getAlwaysOnTop", () =>
    settingsService.getAlwaysOnTop(),
  )
  ipcMain.handle("settings:getDeveloperMode", () =>
    settingsService.getDeveloperMode(),
  )
  ipcMain.handle("settings:setAlwaysOnTop", (_event, value: boolean) =>
    settingsService.setAlwaysOnTop(value),
  )
  ipcMain.handle("settings:setDeveloperMode", (_event, value: boolean) =>
    settingsService.setDeveloperMode(value),
  )
}
