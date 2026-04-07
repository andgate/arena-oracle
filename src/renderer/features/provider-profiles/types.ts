import { ProviderKey } from "@shared/electron-types"

export type ProviderProfileFormValues = {
  name: string
  providerKey: ProviderKey
  apiKey: string
  selectedModel: string
}
