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
