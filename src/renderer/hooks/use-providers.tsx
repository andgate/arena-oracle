import { fetchModelsForProfile } from "@renderer/lib/ai"
import { ProviderProfile } from "@shared/electron-types"
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
  profiles: ProviderProfile[]
  selectedProfile: ProviderProfile | null
  addProfile: (
    profile: Omit<ProviderProfile, "id">,
  ) => Promise<ProviderProfile>
  updateProfile: (
    id: string,
    updates: Partial<Omit<ProviderProfile, "id">>,
  ) => Promise<ProviderProfile>
  removeProfile: (id: string) => Promise<void>
  selectProfile: (id: string) => Promise<void>
  getApiKey: (id: string) => Promise<string | null>
  setApiKey: (id: string, apiKey: string) => Promise<void>
  fetchModels: (id: string) => Promise<string[]>
}

const ProvidersContext = createContext<UseProvidersResult | null>(null)

export function ProvidersProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profiles, setProfiles] = useState<ProviderProfile[]>([])
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

    void loadProviders()
  }, [])

  const selectProfile = async (id: string) => {
    await window.mtgaAPI.providers.setSelectedProfileId(id)
    setSelectedProfileId(id)
    setError(null)
  }

  const addProfile = async (profile: Omit<ProviderProfile, "id">) => {
    const nextProfile = await window.mtgaAPI.providers.addProfile(profile)
    const nextSelectedProfileId =
      await window.mtgaAPI.providers.getSelectedProfileId()

    setProfiles((current) => [...current, nextProfile])
    setSelectedProfileId(nextSelectedProfileId)
    setError(null)

    return nextProfile
  }

  const updateProfile = async (
    id: string,
    updates: Partial<Omit<ProviderProfile, "id">>,
  ) => {
    const nextProfile = await window.mtgaAPI.providers.updateProfile(id, updates)

    setProfiles((current) =>
      current.map((profile) => (profile.id === id ? nextProfile : profile)),
    )
    setError(null)

    return nextProfile
  }

  const removeProfile = async (id: string) => {
    await window.mtgaAPI.providers.removeProfile(id)
    const nextSelectedProfileId =
      await window.mtgaAPI.providers.getSelectedProfileId()

    setProfiles((current) => current.filter((profile) => profile.id !== id))
    setSelectedProfileId(nextSelectedProfileId)
    setError(null)
  }

  const getApiKey = (id: string) => window.mtgaAPI.providers.getApiKey(id)

  const setApiKey = async (id: string, apiKey: string) => {
    await window.mtgaAPI.providers.setApiKey(id, apiKey)
    setError(null)
  }

  const fetchModels = async (id: string) => {
    const profile = profiles.find((candidate) => candidate.id === id)

    if (!profile) {
      throw new Error(`Provider profile "${id}" was not found.`)
    }

    const response = await fetchModelsForProfile(profile)
    setError(null)

    return response
  }

  const selectedProfile =
    profiles.find((profile) => profile.id === selectedProfileId) ?? null

  return (
    <ProvidersContext.Provider
      value={{
        error,
        isLoading,
        profiles,
        selectedProfile,
        addProfile,
        updateProfile,
        removeProfile,
        selectProfile,
        getApiKey,
        setApiKey,
        fetchModels,
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
