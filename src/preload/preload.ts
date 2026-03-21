// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { CoachingSnapshot } from "@shared/coaching-types"
import { IpcChannels, MTGAElectronAPI } from "@shared/electron-types"
import { GameState } from "@shared/game-state-types"
import { contextBridge, ipcRenderer } from "electron"

// Setup MTGA API
const mtgaAPI: MTGAElectronAPI = {
  gameState: {
    get: () => ipcRenderer.invoke("gameState:get"),
    onStateUpdated: (callback) => {
      ipcRenderer.on("gameState:stateUpdated", (_event, state: GameState) =>
        callback(state),
      )
    },
    onDecisionRequired: (callback) => {
      ipcRenderer.on("gameState:decisionRequired", (_event, state: GameState) =>
        callback(state),
      )
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners("gameState:stateUpdated")
      ipcRenderer.removeAllListeners("gameState:decisionRequired")
    },
  },

  cardDb: {
    isLoaded: () => ipcRenderer.invoke("cardDb:isLoaded"),
    lookupCard: (grpId: number) =>
      ipcRenderer.invoke("cardDb:lookupCard", grpId),
  },
  coaching: {
    get: () => ipcRenderer.invoke("coaching:get"),
    onSnapshotReady: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        snapshot: CoachingSnapshot,
      ) => callback(snapshot)
      ipcRenderer.on("coaching:snapshotReady", listener)
      return () =>
        ipcRenderer.removeListener("coaching:snapshotReady", listener)
    },
  },
}

// Setup generic IPC channels for renderer. We use a WeakMap to track the 
// dynamically created wrapper functions so they can be properly removed.
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