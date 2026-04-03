import { ResolvedCard } from "./card-types"

export interface CardDbAPI {
  isLoaded: () => Promise<boolean>
  lookupCard: (grpId: number) => Promise<ResolvedCard | null>
}

export interface AppSettings {
  alwaysOnTop: boolean
  developerMode: boolean
}

export type AppStoreSchema = AppSettings & ProviderStoreState

export interface SettingsAPI {
  get: () => Promise<AppSettings>
  getAlwaysOnTop: () => Promise<boolean>
  getDeveloperMode: () => Promise<boolean>
  setAlwaysOnTop: (value: boolean) => Promise<void>
  setDeveloperMode: (value: boolean) => Promise<void>
}

export type ProviderKey = "groq" | "openrouter"

export interface ProviderProfile {
  id: string
  name: string
  providerKey: ProviderKey
  selectedModel: string
}

export interface ProviderStoreState {
  providerProfiles: ProviderProfile[]
  selectedProviderProfileId: string | null
}

export interface ProvidersAPI {
  getProfiles: () => Promise<ProviderProfile[]>
  addProfile: (profile: Omit<ProviderProfile, "id">) => Promise<ProviderProfile>
  updateProfile: (
    id: string,
    updates: Partial<Omit<ProviderProfile, "id">>,
  ) => Promise<ProviderProfile>
  removeProfile: (id: string) => Promise<void>
  getSelectedProfileId: () => Promise<string | null>
  setSelectedProfileId: (id: string) => Promise<void>
  getApiKey: (id: string) => Promise<string | null>
  setApiKey: (id: string, apiKey: string) => Promise<void>
}

export interface MTGAElectronAPI {
  cardDb: CardDbAPI
  providers: ProvidersAPI
  settings: SettingsAPI
}

export interface IpcChannels {
  send: (channel: string, ...args: unknown[]) => void
  on: (channel: string, cb: (...args: any[]) => void) => void
  once: (channel: string, cb: (...args: any[]) => void) => void
  remove: (channel: string, cb: (...args: any[]) => void) => void
}
