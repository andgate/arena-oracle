import { AppStoreSchema } from "@shared/electron-types"
import Store from "electron-store"
import { injectable, singleton } from "tsyringe"
import { IStoreService } from "./StoreService.interface"

const defaultStore: AppStoreSchema = {
  alwaysOnTop: false,
  developerMode: false,
  providerProfiles: {},
  selectedProviderProfileId: null,
}

@injectable()
@singleton()
export class StoreService implements IStoreService {
  private store = new Store<AppStoreSchema>({
    name: "settings",
    defaults: defaultStore,
    // electron-store validates this schema with AJV using JSON Schema draft 2020-12.
    // Spec: https://json-schema.org/draft/2020-12/json-schema-core
    schema: {
      alwaysOnTop: {
        type: "boolean",
        default: defaultStore.alwaysOnTop,
      },
      developerMode: {
        type: "boolean",
        default: defaultStore.developerMode,
      },
      providerProfiles: {
        type: "object",
        default: defaultStore.providerProfiles,
        additionalProperties: {
          type: "object",
          required: ["id", "name", "providerKey", "selectedModel", "hasApiKey"],
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            providerKey: {
              type: "string",
              enum: ["groq", "openrouter"],
            },
            selectedModel: { type: "string" },
            hasApiKey: { type: "boolean" },
          },
        },
      },
      selectedProviderProfileId: {
        type: ["string", "null"],
        default: defaultStore.selectedProviderProfileId,
      },
    },
  })

  get<K extends keyof AppStoreSchema>(key: K): AppStoreSchema[K] {
    return this.store.get(key)
  }

  set<K extends keyof AppStoreSchema>(key: K, value: AppStoreSchema[K]): void {
    this.store.set(key, value)
  }
}
