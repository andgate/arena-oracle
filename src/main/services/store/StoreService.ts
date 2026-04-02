import { AppSettings } from "@shared/electron-types"
import Store from "electron-store"
import { injectable, singleton } from "tsyringe"
import { IStoreService } from "./StoreService.interface"

const defaultSettings: AppSettings = {
  alwaysOnTop: false,
  developerMode: false,
}

@injectable()
@singleton()
export class StoreService implements IStoreService {
  private store = new Store<AppSettings>({
    name: "settings",
    defaults: defaultSettings,
    schema: {
      alwaysOnTop: {
        type: "boolean",
        default: defaultSettings.alwaysOnTop,
      },
      developerMode: {
        type: "boolean",
        default: defaultSettings.developerMode,
      },
    },
  })

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.store.get(key)
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.store.set(key, value)
  }
}
