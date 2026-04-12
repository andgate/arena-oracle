// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { IpcChannels, MTGAElectronAPI } from "@shared/electron-types"
import { contextBridge, ipcRenderer } from "electron"

// Setup MTGA API
const mtgaAPI: MTGAElectronAPI = {
  cardDb: {
    isLoaded: () => ipcRenderer.invoke("cardDb:isLoaded"),
    lookupCard: (grpId: number) =>
      ipcRenderer.invoke("cardDb:lookupCard", grpId),
  },
  providers: {
    getProfiles: () => ipcRenderer.invoke("providers:getProfiles"),
    addProfile: (profile) =>
      ipcRenderer.invoke("providers:addProfile", profile),
    updateProfile: (id, updates) =>
      ipcRenderer.invoke("providers:updateProfile", id, updates),
    removeProfile: (id: string) =>
      ipcRenderer.invoke("providers:removeProfile", id),
    getSelectedProfileId: () =>
      ipcRenderer.invoke("providers:getSelectedProfileId"),
    setSelectedProfileId: (id: string) =>
      ipcRenderer.invoke("providers:setSelectedProfileId", id),
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    getAlwaysOnTop: () => ipcRenderer.invoke("settings:getAlwaysOnTop"),
    getDeveloperMode: () => ipcRenderer.invoke("settings:getDeveloperMode"),
    setAlwaysOnTop: (value: boolean) =>
      ipcRenderer.invoke("settings:setAlwaysOnTop", value),
    setDeveloperMode: (value: boolean) =>
      ipcRenderer.invoke("settings:setDeveloperMode", value),
  },
}

// Setup generic, observable IPC channels for renderer.
// We use a WeakMap to track the dynamically created wrapper functions
// so they can be properly removed.
const listenerMap = new WeakMap<
  (...args: unknown[]) => void,
  (_event: Electron.IpcRendererEvent, ...args: unknown[]) => void
>()

const channels: IpcChannels = {
  send: (channel: string, ...args: unknown[]) =>
    ipcRenderer.send(channel, ...args),

  on: (channel: string, cb: (...args: unknown[]) => void) => {
    const wrapper = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      cb(...args)
    listenerMap.set(cb, wrapper)
    ipcRenderer.on(channel, wrapper)
  },

  once: (channel: string, cb: (...args: unknown[]) => void) => {
    const wrapper = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      cb(...args)
    listenerMap.set(cb, wrapper)
    ipcRenderer.once(channel, wrapper)
  },

  remove: (channel: string, cb: (...args: unknown[]) => void) => {
    const wrapper = listenerMap.get(cb)
    if (wrapper) {
      ipcRenderer.removeListener(channel, wrapper)
      listenerMap.delete(cb)
    }
  },
}

// Expose mtgaAPI and channels to renderer
contextBridge.exposeInMainWorld("mtgaAPI", mtgaAPI)
contextBridge.exposeInMainWorld("channels", channels)
