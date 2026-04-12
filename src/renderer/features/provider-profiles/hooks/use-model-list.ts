import { fetchModelsForProvider } from "@renderer/lib/ai"
import { providerConfig } from "@shared/provider-config"
import { ProviderKey } from "@shared/provider-profile-types"
import { useEffect, useState } from "react"

type UseModelListParams = {
  providerKey: ProviderKey
  apiKeyOverride?: string
}

export type UseModelListResult = {
  models: string[]
  isLoading: boolean
  error: string | null
  canFetchModels: boolean
}

export function useModelList({
  providerKey,
  apiKeyOverride = "",
}: UseModelListParams): UseModelListResult {
  const [models, setModels] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const modelListConfig = providerConfig[providerKey].modelList
  const trimmedApiKeyOverride = apiKeyOverride.trim()
  const canFetchModels =
    !modelListConfig.requiresApiKey ||
    trimmedApiKeyOverride !== ""

  useEffect(() => {
    if (!canFetchModels) {
      setModels([])
      setError(null)
      setIsLoading(false)
      return
    }

    let cancelled = false

    const loadModels = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const apiKey =
          modelListConfig.requiresApiKey && trimmedApiKeyOverride !== ""
            ? trimmedApiKeyOverride
            : undefined

        const nextModels = await fetchModelsForProvider(providerKey, apiKey)

        if (cancelled) {
          return
        }

        setModels(Array.from(new Set(nextModels)).sort())
      } catch (nextError) {
        if (cancelled) {
          return
        }

        setModels([])
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to fetch models for this provider.",
        )
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadModels().catch(console.error)

    return () => {
      cancelled = true
    }
  }, [
    canFetchModels,
    modelListConfig.requiresApiKey,
    providerKey,
    trimmedApiKeyOverride,
  ])

  return {
    models,
    isLoading,
    error,
    canFetchModels,
  }
}
