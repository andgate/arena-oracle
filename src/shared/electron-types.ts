import { ResolvedCard } from "./card-types"

export interface CardDbAPI {
  isLoaded: () => Promise<boolean>
  lookupCard: (grpId: number) => Promise<ResolvedCard | null>
}

export interface AppSettings {
  alwaysOnTop: boolean
  developerMode: boolean
}

export interface SettingsAPI {
  get: () => Promise<AppSettings>
  getAlwaysOnTop: () => Promise<boolean>
  getDeveloperMode: () => Promise<boolean>
  setAlwaysOnTop: (value: boolean) => Promise<void>
  setDeveloperMode: (value: boolean) => Promise<void>
}

export interface MTGAElectronAPI {
  cardDb: CardDbAPI
  settings: SettingsAPI
}

export interface IpcChannels {
  send: (channel: string, ...args: unknown[]) => void
  on: (channel: string, cb: (...args: any[]) => void) => void
  once: (channel: string, cb: (...args: any[]) => void) => void
  remove: (channel: string, cb: (...args: any[]) => void) => void
}
