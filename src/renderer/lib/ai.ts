import { createGroq } from "@ai-sdk/groq"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { ProviderKey, ProviderProfile } from "@shared/electron-types"
import type { LanguageModel } from "ai"

export type ChatModel = "groq" | "free"

type ModelsResponse = {
  data?: Array<{
    id?: unknown
  }>
}

type ProviderConfig = {
  modelsUrl: string
  requiresApiKey: boolean
}

const providerConfigs: Record<ProviderKey, ProviderConfig> = {
  groq: {
    modelsUrl: "https://api.groq.com/openai/v1/models",
    requiresApiKey: true,
  },
  openrouter: {
    modelsUrl: "https://openrouter.ai/api/v1/models",
    requiresApiKey: false,
  },
}

export const groq = createGroq({ apiKey: import.meta.env.VITE_GROQ_API_KEY })
export const openrouter = createOpenRouter({
  apiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
})

const models: Record<ChatModel, LanguageModel> = {
  groq: groq("openai/gpt-oss-120b"),
  free: openrouter.chat("openrouter/free"),
}

export function getModel(model: ChatModel): LanguageModel {
  return models[model]
}

export async function fetchModelsForProfile(
  profile: ProviderProfile,
): Promise<string[]> {
  const response = await fetchProviderModelsResponse(profile)
  return parseProviderModelsResponse(response, profile.providerKey)
}

function getProviderConfig(providerKey: ProviderKey): ProviderConfig {
  return providerConfigs[providerKey]
}

async function fetchProviderModelsResponse(
  profile: ProviderProfile,
): Promise<Response> {
  const response = await fetch(
    getProviderConfig(profile.providerKey).modelsUrl,
    {
      headers: await getProviderAuthHeaders(profile),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Failed to fetch models for provider "${profile.providerKey}".`,
    )
  }

  return response
}

async function getProviderAuthHeaders(
  profile: ProviderProfile,
): Promise<Record<string, string>> {
  if (!getProviderConfig(profile.providerKey).requiresApiKey) {
    return {}
  }

  const apiKey = await window.mtgaAPI.providers.getApiKey(profile.id)

  if (!apiKey) {
    throw new Error(
      `Provider profile "${profile.id}" does not have an API key.`,
    )
  }

  return { Authorization: `Bearer ${apiKey}` }
}

async function parseProviderModelsResponse(
  response: Response,
  providerKey: ProviderKey,
): Promise<string[]> {
  const body = (await response.json()) as ModelsResponse

  if (!Array.isArray(body.data)) {
    throw new Error(
      `Provider "${providerKey}" returned an invalid models response.`,
    )
  }

  return body.data
    .map((model) => model.id)
    .filter((modelId): modelId is string => typeof modelId === "string")
}
