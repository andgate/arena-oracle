// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { CoachingSnapshot } from "@shared/coaching-types"
import { MTGAElectronAPI } from "@shared/electron-types"
import { GameState } from "@shared/game-state-types"
import { contextBridge, ipcRenderer } from "electron"

const mtgaAPI: MTGAElectronAPI = {
  playerLog: {
    getLog: () => ipcRenderer.invoke("playerLog:getLog"),
    onChunk: (callback) => {
      ipcRenderer.on("playerLog:chunk", (_event, chunk) => callback(chunk))
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners("playerLog:chunk")
    },
  },
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

contextBridge.exposeInMainWorld("mtgaAPI", mtgaAPI)
