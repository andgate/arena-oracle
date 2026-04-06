import { AppStoreSchema } from "@shared/electron-types"
import { IStoreService } from "./StoreService.interface"

export class FakeStoreService implements IStoreService {
  private values: AppStoreSchema = {
    alwaysOnTop: false,
    developerMode: false,
    providerProfiles: {},
    selectedProviderProfileId: null,
  }

  get<K extends keyof AppStoreSchema>(key: K): AppStoreSchema[K] {
    return this.values[key]
  }

  set<K extends keyof AppStoreSchema>(key: K, value: AppStoreSchema[K]): void {
    this.values[key] = value
  }
}
