import {
  useAddProviderProfileMutation,
  useProvidersStateQuery,
  useRemoveProviderProfileMutation,
  useSelectProviderProfileMutation,
  useUpdateProviderProfileMutation,
} from "@renderer/queries/providers-query"
import { ProviderProfile, ProviderProfileInput } from "@shared/provider-profile-types"
import { createContext, ReactNode, useContext } from "react"

interface UseProvidersResult {
  error: Error | null
  isLoading: boolean
  profiles: Record<string, ProviderProfile>
  selectedProfile: ProviderProfile | null
  selectedProfileId: string | null
  addProfile: (profile: ProviderProfileInput) => Promise<ProviderProfile>
  updateProfile: (
    id: string,
    updates: ProviderProfileInput,
  ) => Promise<ProviderProfile>
  removeProfile: (id: string) => Promise<void>
  selectProfile: (id: string) => Promise<void>
}

const ProvidersContext = createContext<UseProvidersResult | null>(null)

export function ProvidersProvider({ children }: { children: ReactNode }) {
  const providersStateQuery = useProvidersStateQuery()
  const addProfileMutation = useAddProviderProfileMutation()
  const updateProfileMutation = useUpdateProviderProfileMutation()
  const removeProfileMutation = useRemoveProviderProfileMutation()
  const selectProfileMutation = useSelectProviderProfileMutation()

  const profiles = providersStateQuery.data?.profiles ?? {}
  const selectedProfileId = providersStateQuery.data?.selectedProfileId ?? null

  const selectProfile = async (id: string) => {
    await selectProfileMutation.mutateAsync(id)
  }

  const addProfile = async (profile: ProviderProfileInput) => {
    const { nextProfile } = await addProfileMutation.mutateAsync(profile)
    return nextProfile
  }

  const updateProfile = async (id: string, updates: ProviderProfileInput) => {
    const { nextProfile } = await updateProfileMutation.mutateAsync({
      id,
      updates,
    })
    return nextProfile
  }

  const removeProfile = async (id: string) => {
    await removeProfileMutation.mutateAsync(id)
  }

  const selectedProfile = selectedProfileId
    ? (profiles[selectedProfileId] ?? null)
    : null

  const error =
    providersStateQuery.error ??
    addProfileMutation.error ??
    updateProfileMutation.error ??
    removeProfileMutation.error ??
    selectProfileMutation.error ??
    null

  return (
    <ProvidersContext.Provider
      value={{
        error,
        isLoading: providersStateQuery.isLoading,
        profiles,
        selectedProfile,
        selectedProfileId,
        addProfile,
        updateProfile,
        removeProfile,
        selectProfile,
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
