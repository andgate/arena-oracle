import type { IpcChannels, MTGAElectronAPI } from "../shared/electron-types"

declare global {
  interface Window {
    mtgaAPI: MTGAElectronAPI
    channels: IpcChannels
  }
}

export {}
