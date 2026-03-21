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

// Setup IPC channels for renderer
const channels: IpcChannels = {
  send: (channel: string, ...args: unknown[]) =>
    ipcRenderer.send(channel, ...args),

  on: (channel: string, cb: (...args: unknown[]) => void) =>
    ipcRenderer.on(channel, (_event, ...args) => cb(...args)),

  once: (channel: string, cb: (...args: unknown[]) => void) =>
    ipcRenderer.once(channel, (_event, ...args) => cb(...args)),

  remove: (channel: string, cb: (...args: unknown[]) => void) =>
    ipcRenderer.removeListener(channel, cb),
}

// Expose mtgaAPI and channels to renderer
contextBridge.exposeInMainWorld("mtgaAPI", mtgaAPI)
contextBridge.exposeInMainWorld("channels", channels)