import type { MTGAElectronAPI } from "../shared/electron-types"

declare global {
  interface Window {
    mtgaAPI: MTGAElectronAPI
  }
}
