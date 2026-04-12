import { ProviderKey } from "@shared/provider-profile-types"

export type ProviderProfileFormValues = {
  name: string
  providerKey: ProviderKey
  apiKey: string
  selectedModel: string
}
