import { getProperty, setProperty } from "dot-prop"
import type { Get, Paths } from "type-fest"
import { AppStoreSchema } from "./app-store-schema"
import { IStoreService } from "./StoreService.interface"

export class FakeStoreService implements IStoreService {
  private values: AppStoreSchema = {
    alwaysOnTop: false,
    developerMode: false,
    providerProfiles: {},
    selectedProviderProfileId: null,
  }

  get<K extends keyof AppStoreSchema>(key: K): AppStoreSchema[K]
  get<P extends Paths<AppStoreSchema>>(path: P): Get<AppStoreSchema, P>
  get(path: string): unknown {
    return getProperty(this.values, path)
  }

  set<K extends keyof AppStoreSchema>(key: K, value: AppStoreSchema[K]): void
  set<P extends Paths<AppStoreSchema>>(
    path: P,
    value: Get<AppStoreSchema, P>,
  ): void
  set(path: string, value: unknown): void {
    setProperty(this.values, path, value)
  }
}
