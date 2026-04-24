import { ipcMain } from "electron"
import { container } from "../services/container"
import { IProviderService } from "../services/providers/ProviderService.interface"

export function registerProvidersIPC() {
  const providerService = container.resolve<IProviderService>(IProviderService)

  ipcMain.handle("providers:getProfiles", () => providerService.getProfiles())
  ipcMain.handle("providers:createProfile", (_event, initial) =>
    providerService.createProfile(initial),
  )
  ipcMain.handle("providers:setProfileName", (_event, id, name) =>
    providerService.setProfileName(id, name),
  )
  ipcMain.handle("providers:setProfileProvider", (_event, id, providerKey) =>
    providerService.setProfileProvider(id, providerKey),
  )
  ipcMain.handle("providers:setProfileModel", (_event, id, model) =>
    providerService.setProfileModel(id, model),
  )
  ipcMain.handle("providers:setProfileApiKey", (_event, id, apiKey) =>
    providerService.setProfileApiKey(id, apiKey),
  )
  ipcMain.handle("providers:deleteProfile", (_event, id) =>
    providerService.deleteProfile(id),
  )
  ipcMain.handle("providers:getSelectedProfileId", () =>
    providerService.getSelectedProfileId(),
  )
  ipcMain.handle("providers:setSelectedProfileId", (_event, id) =>
    providerService.setSelectedProfileId(id),
  )
}
