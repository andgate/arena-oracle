import { ipcMain } from "electron"
import { container } from "../services/container"
import { IProviderService } from "../services/providers/ProviderService.interface"

export function registerProvidersIPC() {
  const providerService = container.resolve<IProviderService>(IProviderService)

  ipcMain.handle("providers:getProfiles", () => providerService.getProfiles())
  ipcMain.handle("providers:addProfile", (_event, profile) =>
    providerService.addProfile(profile),
  )
  ipcMain.handle("providers:updateProfile", (_event, id, updates) =>
    providerService.updateProfile(id, updates),
  )
  ipcMain.handle("providers:removeProfile", (_event, id) =>
    providerService.removeProfile(id),
  )
  ipcMain.handle("providers:getSelectedProfileId", () =>
    providerService.getSelectedProfileId(),
  )
  ipcMain.handle("providers:setSelectedProfileId", (_event, id) =>
    providerService.setSelectedProfileId(id),
  )
  ipcMain.handle("providers:getApiKey", (_event, id) =>
    providerService.getApiKey(id),
  )
  ipcMain.handle("providers:setApiKey", (_event, id, apiKey) =>
    providerService.setApiKey(id, apiKey),
  )
}
