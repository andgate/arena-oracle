import { AppSettings } from "@shared/electron-types"

export const IStoreService = Symbol("IStoreService")

export interface IStoreService {
  get<K extends keyof AppSettings>(key: K): AppSettings[K]
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void
}
