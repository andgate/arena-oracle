export const providerKeys = ["groq", "openrouter"] as const

export type ProviderKey = (typeof providerKeys)[number]

export interface ProviderProfile {
  id: string
  name?: string
  providerKey?: ProviderKey
  selectedModel?: string
  apiKey?: string
}

export type ProviderProfileInput = Omit<ProviderProfile, "id">
