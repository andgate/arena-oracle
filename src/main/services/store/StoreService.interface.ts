import type { Get, Paths } from "type-fest"
import { AppStoreSchema } from "./app-store-schema"

export const IStoreService = Symbol("IStoreService")

export interface IStoreService {
  get<K extends keyof AppStoreSchema>(key: K): AppStoreSchema[K]
  get<P extends Paths<AppStoreSchema>>(path: P): Get<AppStoreSchema, P>
  set<K extends keyof AppStoreSchema>(key: K, value: AppStoreSchema[K]): void
  set<P extends Paths<AppStoreSchema>>(path: P, value: Get<AppStoreSchema, P>): void
}
