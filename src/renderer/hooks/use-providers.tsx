import {
  CreateProviderProfileInput,
  ProviderProfile,
  UpdateProviderProfileInput,
} from "@shared/electron-types"
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"

interface UseProvidersResult {
  error: Error | null
  isLoading: boolean
  profiles: Record<string, ProviderProfile>
  selectedProfile: ProviderProfile | null
  selectedProfileId: string | null
  addProfile: (profile: CreateProviderProfileInput) => Promise<ProviderProfile>
  updateProfile: (
    id: string,
    updates: UpdateProviderProfileInput,
  ) => Promise<ProviderProfile>
  removeProfile: (id: string) => Promise<void>
  selectProfile: (id: string) => Promise<void>
  setApiKey: (id: string, apiKey: string) => Promise<void>
}

const ProvidersContext = createContext<UseProvidersResult | null>(null)

export function ProvidersProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profiles, setProfiles] = useState<Record<string, ProviderProfile>>({})
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  )

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const [nextProfiles, nextSelectedProfileId] = await Promise.all([
          window.mtgaAPI.providers.getProfiles(),
          window.mtgaAPI.providers.getSelectedProfileId(),
        ])
        setProfiles(nextProfiles)
        setSelectedProfileId(nextSelectedProfileId)
        setError(null)
      } catch (nextError: unknown) {
        setError(
          nextError instanceof Error
            ? nextError
            : new Error("Failed to load provider profiles."),
        )
      } finally {
        setIsLoading(false)
      }
    }

    loadProviders().catch(console.error)
  }, [])

  const selectProfile = async (id: string) => {
    await window.mtgaAPI.providers.setSelectedProfileId(id)
    setSelectedProfileId(id)
    setError(null)
  }

  const addProfile = async (profile: CreateProviderProfileInput) => {
    const nextProfile = await window.mtgaAPI.providers.addProfile(profile)
    const nextSelectedProfileId =
      await window.mtgaAPI.providers.getSelectedProfileId()

    setProfiles((current) => ({
      ...current,
      [nextProfile.id]: nextProfile,
    }))
    setSelectedProfileId(nextSelectedProfileId)
    setError(null)

    return nextProfile
  }

  const updateProfile = async (
    id: string,
    updates: UpdateProviderProfileInput,
  ) => {
    const nextProfile = await window.mtgaAPI.providers.updateProfile(id, updates)

    setProfiles((current) => ({
      ...current,
      [id]: nextProfile,
    }))
    setError(null)

    return nextProfile
  }

  const removeProfile = async (id: string) => {
    await window.mtgaAPI.providers.removeProfile(id)
    const nextSelectedProfileId =
      await window.mtgaAPI.providers.getSelectedProfileId()

    setProfiles((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setSelectedProfileId(nextSelectedProfileId)
    setError(null)
  }

  const setApiKey = async (id: string, apiKey: string) => {
    await window.mtgaAPI.providers.setApiKey(id, apiKey)
    setProfiles((current) => ({
      ...current,
      [id]: {
        ...current[id],
        hasApiKey: true,
      },
    }))
    setError(null)
  }

  const selectedProfile = selectedProfileId
    ? profiles[selectedProfileId] ?? null
    : null

  return (
    <ProvidersContext.Provider
      value={{
        error,
        isLoading,
        profiles,
        selectedProfile,
        selectedProfileId,
        addProfile,
        updateProfile,
        removeProfile,
        selectProfile,
        setApiKey,
      }}
    >
      {children}
    </ProvidersContext.Provider>
  )
}

export function useProviders(): UseProvidersResult {
  const context = useContext(ProvidersContext)

  if (!context) {
    throw new Error("useProviders must be used within a ProvidersProvider.")
  }

  return context
}
