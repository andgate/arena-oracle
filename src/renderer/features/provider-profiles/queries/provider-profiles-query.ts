import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ProviderKey, ProviderProfileInput } from "@shared/provider-profile-types"

export const providerProfilesQueryKey = ["provider-profiles"] as const

export function useProviderProfilesQuery() {
  return useQuery({
    queryKey: providerProfilesQueryKey,
    queryFn: () => window.mtgaAPI.providers.getProfiles(),
  })
}

export function useCreateProviderProfile() {
  const queryClient = useQueryClient()
  return useMutation<string, Error, ProviderProfileInput | undefined>({
    mutationFn: (initial) => window.mtgaAPI.providers.createProfile(initial),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: providerProfilesQueryKey }),
  })
}

export function useDeleteProviderProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.mtgaAPI.providers.deleteProfile(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: providerProfilesQueryKey }),
  })
}

export function useProviderProfileNameSetter(profileId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => {
      if (!profileId) throw new Error("No profile selected")
      return window.mtgaAPI.providers.setProfileName(profileId, name)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: providerProfilesQueryKey }),
  })
}

export function useProviderProfileApiKeySetter(profileId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (apiKey: string) => {
      if (!profileId) throw new Error("No profile selected")
      return window.mtgaAPI.providers.setProfileApiKey(profileId, apiKey)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: providerProfilesQueryKey }),
  })
}

export function useProviderProfileModelSetter(profileId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (model: string) => {
      if (!profileId) throw new Error("No profile selected")
      return window.mtgaAPI.providers.setProfileModel(profileId, model)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: providerProfilesQueryKey }),
  })
}

export function useProviderProfileProviderSetter(profileId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (providerKey: ProviderKey) => {
      if (!profileId) throw new Error("No profile selected")
      return window.mtgaAPI.providers.setProfileProvider(profileId, providerKey)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: providerProfilesQueryKey }),
  })
}
