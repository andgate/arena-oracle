import { createGroq } from "@ai-sdk/groq"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { ProviderKey, ProviderProfile } from "@shared/provider-profile-types"
import { providerConfig } from "@shared/provider-config"
import type { LanguageModel } from "ai"

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type ModelsResponse = {
  data?: Array<{
    id?: unknown
  }>
}

// ----------------------------------------------------------------------------
// Validation helpers
// ----------------------------------------------------------------------------

function requireProviderKey(providerKey?: ProviderKey): ProviderKey {
  if (!providerKey) {
    throw new Error("Provider key is required.")
  }

  return providerKey
}

function requireProfileProviderKey(profile: ProviderProfile): ProviderKey {
  if (!profile.providerKey) {
    throw new Error(
      `Provider profile "${profile.id}" does not have a provider key.`,
    )
  }

  return profile.providerKey
}

function requireProfileSelectedModel(profile: ProviderProfile): string {
  if (!profile.selectedModel?.trim()) {
    throw new Error(
      `Provider profile "${profile.id}" does not have a selected model.`,
    )
  }

  return profile.selectedModel.trim()
}

// ----------------------------------------------------------------------------
// Language model creation
// ----------------------------------------------------------------------------

export async function getLanguageModelForProfile(
  profile: ProviderProfile,
): Promise<LanguageModel> {
  const providerKey = requireProfileProviderKey(profile)
  const modelId = requireProfileSelectedModel(profile)
  const apiKey = profile.apiKey?.trim()

  if (!apiKey) {
    throw new Error(
      `Provider profile "${profile.id}" does not have an API key.`,
    )
  }

  return createLanguageModel(providerKey, modelId, apiKey)
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
  const providerKey = requireProfileProviderKey(profile)
  const response = await fetchProviderModelsResponse(profile)
  return parseProviderModelsResponse(response, providerKey)
}

export async function fetchModelsForProvider(
  providerKey?: ProviderKey,
  apiKey?: string,
): Promise<string[]> {
  const resolvedProviderKey = requireProviderKey(providerKey)
  const response = await fetchProviderModelsEndpoint(
    resolvedProviderKey,
    apiKey,
  )
  return parseProviderModelsResponse(response, resolvedProviderKey)
}

async function fetchProviderModelsResponse(
  profile: ProviderProfile,
): Promise<Response> {
  const providerKey = requireProfileProviderKey(profile)
  const config = providerConfig[providerKey].modelList

  if (!config.requiresApiKey) {
    return fetchProviderModelsEndpoint(providerKey)
  }

  const apiKey = profile.apiKey?.trim()

  if (!apiKey) {
    throw new Error(
      `Provider profile "${profile.id}" does not have an API key.`,
    )
  }

  return fetchProviderModelsEndpoint(providerKey, apiKey)
}

// ----------------------------------------------------------------------------
// Fetch helpers
// ----------------------------------------------------------------------------

async function fetchProviderModelsEndpoint(
  providerKey: ProviderKey,
  apiKey?: string,
): Promise<Response> {
  const config = providerConfig[providerKey].modelList

  if (config.requiresApiKey && !apiKey?.trim()) {
    throw new Error(`Provider "${providerKey}" requires an API key.`)
  }

  const response = await fetch(config.url, {
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
  if (!providerConfig[providerKey].modelList.requiresApiKey) {
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
