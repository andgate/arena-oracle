import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export const selectedProviderProfileQueryKey = ["selected-provider-profile"] as const

export function useSelectedProviderProfileQuery() {
  return useQuery({
    queryKey: selectedProviderProfileQueryKey,
    queryFn: () => window.mtgaAPI.providers.getSelectedProfileId(),
  })
}

export function useSetSelectedProviderProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.mtgaAPI.providers.setSelectedProfileId(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: selectedProviderProfileQueryKey }),
  })
}
