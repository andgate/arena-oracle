import { AppSettings } from "@shared/electron-types"

export const ISettingsService = Symbol("ISettingsService")

export interface ISettingsService {
  get(): AppSettings
  getAlwaysOnTop(): boolean
  getDeveloperMode(): boolean
  setAlwaysOnTop(value: boolean): void
  setDeveloperMode(value: boolean): void
}
