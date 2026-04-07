import { createGroq } from "@ai-sdk/groq"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { ProviderKey, ProviderProfile } from "@shared/electron-types"
import type { LanguageModel } from "ai"

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type ModelsResponse = {
  data?: Array<{
    id?: unknown
  }>
}

type ProviderModelsListConfig = {
  modelsUrl: string
  requiresApiKey: boolean
}

// ----------------------------------------------------------------------------
// Provider configuration
// ----------------------------------------------------------------------------

export const providerModelsListConfig: Record<
  ProviderKey,
  ProviderModelsListConfig
> = {
  groq: {
    modelsUrl: "https://api.groq.com/openai/v1/models",
    requiresApiKey: true,
  },
  openrouter: {
    modelsUrl: "https://openrouter.ai/api/v1/models",
    requiresApiKey: false,
  },
}

// ----------------------------------------------------------------------------
// Language model creation
// ----------------------------------------------------------------------------

export async function getLanguageModelForProfile(
  profile: ProviderProfile,
): Promise<LanguageModel> {
  const apiKey = await window.mtgaAPI.providers.getApiKey(profile.id)

  if (!apiKey) {
    throw new Error(
      `Provider profile "${profile.id}" does not have an API key.`,
    )
  }

  return createLanguageModel(profile.providerKey, profile.selectedModel, apiKey)
}

function createLanguageModel(
  providerKey: ProviderKey,
  modelId: string,
  apiKey: string,
): LanguageModel {
  switch (providerKey) {
    case "groq":
      return createGroq({ apiKey })(modelId)
    case "openrouter":
      return createOpenRouter({ apiKey }).chat(modelId)
  }
}

// ----------------------------------------------------------------------------
// Model fetching
// ----------------------------------------------------------------------------

export async function fetchModelsForProfile(
  profile: ProviderProfile,
): Promise<string[]> {
  const response = await fetchProviderModelsResponse(profile)
  return parseProviderModelsResponse(response, profile.providerKey)
}

export async function fetchModelsForProvider(
  providerKey: ProviderKey,
  apiKey?: string,
): Promise<string[]> {
  const response = await fetchProviderModelsEndpoint(providerKey, apiKey)
  return parseProviderModelsResponse(response, providerKey)
}

async function fetchProviderModelsResponse(
  profile: ProviderProfile,
): Promise<Response> {
  const config = providerModelsListConfig[profile.providerKey]

  if (!config.requiresApiKey) {
    return fetchProviderModelsEndpoint(profile.providerKey)
  }

  const apiKey = await window.mtgaAPI.providers.getApiKey(profile.id)

  if (!apiKey) {
    throw new Error(
      `Provider profile "${profile.id}" does not have an API key.`,
    )
  }

  return fetchProviderModelsEndpoint(profile.providerKey, apiKey)
}

async function fetchProviderModelsEndpoint(
  providerKey: ProviderKey,
  apiKey?: string,
): Promise<Response> {
  const config = providerModelsListConfig[providerKey]

  if (config.requiresApiKey && !apiKey?.trim()) {
    throw new Error(`Provider "${providerKey}" requires an API key.`)
  }

  const response = await fetch(config.modelsUrl, {
    headers: getProviderModelsAuthHeaders(providerKey, apiKey),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch models for provider "${providerKey}".`)
  }

  return response
}

function getProviderModelsAuthHeaders(
  providerKey: ProviderKey,
  apiKey?: string,
): Record<string, string> {
  if (!providerModelsListConfig[providerKey].requiresApiKey) {
    return {}
  }

  return { Authorization: `Bearer ${apiKey}` }
}

// ----------------------------------------------------------------------------
// Model parsing
// ----------------------------------------------------------------------------

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
