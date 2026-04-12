import { AppStoreSchema } from "./app-store-schema"

export const IStoreService = Symbol("IStoreService")

export interface IStoreService {
  get<K extends keyof AppStoreSchema>(key: K): AppStoreSchema[K]
  set<K extends keyof AppStoreSchema>(key: K, value: AppStoreSchema[K]): void
}
