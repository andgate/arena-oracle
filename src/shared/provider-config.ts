import { ProviderKey } from "./provider-profile-types"

export type ProviderConfig = {
  label: string
  modelList: {
    url: string
    requiresApiKey: boolean
  }
}

export const providerConfig: Record<ProviderKey, ProviderConfig> = {
  groq: {
    label: "Groq",
    modelList: {
      url: "https://api.groq.com/openai/v1/models",
      requiresApiKey: true,
    },
  },
  openrouter: {
    label: "OpenRouter",
    modelList: {
      url: "https://openrouter.ai/api/v1/models",
      requiresApiKey: false,
    },
  },
}

export const defaultProviderKey = Object.keys(providerConfig)[0] as ProviderKey
