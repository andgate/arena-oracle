export const providerKeys = ["groq", "openrouter"] as const

export type ProviderKey = (typeof providerKeys)[number]

export interface ProviderProfile {
  id: string
  name?: string
  providerKey?: ProviderKey
  selectedModel?: string
  hasApiKey: boolean
}

export interface ProviderProfileInput {
  name?: string
  providerKey?: ProviderKey
  selectedModel?: string
  apiKey?: string
}
