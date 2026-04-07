import {
  CreateProviderProfileInput,
  ProviderProfile,
  UpdateProviderProfileInput,
} from "@shared/electron-types"
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"

// ----------------------------------------------------------------------------
// Interfaces
// ----------------------------------------------------------------------------

export interface ProviderProfilesState {
  profiles: Record<string, ProviderProfile>
  selectedProfileId: string | null
}

interface ProviderMutationContext {
  previousState: ProviderProfilesState | undefined
}

interface AddProviderProfileMutationContext extends ProviderMutationContext {
  temporaryProfileId: string
}

const providersQueryKey = ["providers"] as const

// ----------------------------------------------------------------------------
// Query setup
// ----------------------------------------------------------------------------

// This cache strategy assumes provider state is only mutated through these
// renderer hooks and the Electron handlers they call.
function createTemporaryProfileId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ----------------------------------------------------------------------------
// Electron API calls
// ----------------------------------------------------------------------------

async function getProvidersState(): Promise<ProviderProfilesState> {
  const [profiles, selectedProfileId] = await Promise.all([
    window.mtgaAPI.providers.getProfiles(),
    window.mtgaAPI.providers.getSelectedProfileId(),
  ])

  return {
    profiles,
    selectedProfileId,
  }
}

async function addProviderProfile(profile: CreateProviderProfileInput) {
  const nextProfile = await window.mtgaAPI.providers.addProfile(profile)
  const selectedProfileId =
    await window.mtgaAPI.providers.getSelectedProfileId()

  return {
    nextProfile,
    selectedProfileId,
  }
}

async function updateProviderProfile(
  id: string,
  updates: UpdateProviderProfileInput,
) {
  const nextProfile = await window.mtgaAPI.providers.updateProfile(id, updates)

  return {
    nextProfile,
  }
}

async function removeProviderProfile(id: string) {
  await window.mtgaAPI.providers.removeProfile(id)

  return {
    selectedProfileId: await window.mtgaAPI.providers.getSelectedProfileId(),
  }
}

async function selectProviderProfile(id: string) {
  await window.mtgaAPI.providers.setSelectedProfileId(id)

  return {
    selectedProfileId: id,
  }
}

async function setProviderApiKey(id: string, apiKey: string) {
  await window.mtgaAPI.providers.setApiKey(id, apiKey)

  return {
    id,
  }
}

// ----------------------------------------------------------------------------
// Cache helpers
// ----------------------------------------------------------------------------

function getProvidersStateSnapshot(queryClient: QueryClient) {
  return queryClient.getQueryData<ProviderProfilesState>(providersQueryKey)
}

function setProvidersState(
  queryClient: QueryClient,
  updater: (
    current: ProviderProfilesState | undefined,
  ) => ProviderProfilesState,
) {
  queryClient.setQueryData<ProviderProfilesState>(providersQueryKey, updater)
}

function restoreProvidersState(
  queryClient: QueryClient,
  context: ProviderMutationContext | undefined,
) {
  if (context?.previousState) {
    queryClient.setQueryData(providersQueryKey, context.previousState)
  }
}

// ----------------------------------------------------------------------------
// Query hooks
// ----------------------------------------------------------------------------

export function useProvidersStateQuery() {
  return useQuery({
    queryKey: providersQueryKey,
    queryFn: getProvidersState,
  })
}

// ----------------------------------------------------------------------------
// Mutation hooks
// ----------------------------------------------------------------------------

export function useAddProviderProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addProviderProfile,
    onMutate: async (profile): Promise<AddProviderProfileMutationContext> => {
      await queryClient.cancelQueries({ queryKey: providersQueryKey })

      const previousState = getProvidersStateSnapshot(queryClient)
      const temporaryProfileId = createTemporaryProfileId()

      setProvidersState(queryClient, (current) => {
        const profiles = current?.profiles ?? {}
        const isFirstProfile = Object.keys(profiles).length === 0

        return {
          profiles: {
            ...profiles,
            [temporaryProfileId]: {
              id: temporaryProfileId,
              name: profile.name,
              providerKey: profile.providerKey,
              selectedModel: profile.selectedModel,
              hasApiKey: profile.apiKey.trim().length > 0,
            },
          },
          selectedProfileId: isFirstProfile
            ? temporaryProfileId
            : (current?.selectedProfileId ?? null),
        }
      })

      return {
        previousState,
        temporaryProfileId,
      }
    },
    onError: (_error, _profile, context) => {
      restoreProvidersState(queryClient, context)
    },
    onSuccess: ({ nextProfile, selectedProfileId }, _profile, context) => {
      setProvidersState(queryClient, (current) => {
        const profiles = { ...(current?.profiles ?? {}) }
        delete profiles[context.temporaryProfileId]
        profiles[nextProfile.id] = nextProfile

        return {
          profiles,
          selectedProfileId,
        }
      })
    },
  })
}

export function useUpdateProviderProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: UpdateProviderProfileInput
    }) => updateProviderProfile(id, updates),
    onMutate: async ({ id, updates }): Promise<ProviderMutationContext> => {
      await queryClient.cancelQueries({ queryKey: providersQueryKey })

      const previousState = getProvidersStateSnapshot(queryClient)

      setProvidersState(queryClient, (current) => {
        const existingProfile = current?.profiles[id]

        if (!existingProfile) {
          return current ?? { profiles: {}, selectedProfileId: null }
        }

        return {
          profiles: {
            ...current.profiles,
            [id]: {
              ...existingProfile,
              name: updates.name,
              providerKey: updates.providerKey,
              selectedModel: updates.selectedModel,
              hasApiKey:
                updates.apiKey !== undefined
                  ? updates.apiKey.trim().length > 0
                  : existingProfile.hasApiKey,
            },
          },
          selectedProfileId: current.selectedProfileId,
        }
      })

      return { previousState }
    },
    onError: (_error, _variables, context) => {
      restoreProvidersState(queryClient, context)
    },
    onSuccess: ({ nextProfile }, { id }) => {
      setProvidersState(queryClient, (current) => ({
        profiles: {
          ...(current?.profiles ?? {}),
          [id]: nextProfile,
        },
        selectedProfileId: current?.selectedProfileId ?? null,
      }))
    },
  })
}

export function useRemoveProviderProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: removeProviderProfile,
    onMutate: async (id): Promise<ProviderMutationContext> => {
      await queryClient.cancelQueries({ queryKey: providersQueryKey })

      const previousState = getProvidersStateSnapshot(queryClient)

      setProvidersState(queryClient, (current) => {
        if (!current) {
          return { profiles: {}, selectedProfileId: null }
        }

        const profiles = { ...current.profiles }
        delete profiles[id]

        return {
          profiles,
          selectedProfileId:
            current.selectedProfileId === id ? null : current.selectedProfileId,
        }
      })

      return { previousState }
    },
    onError: (_error, _id, context) => {
      restoreProvidersState(queryClient, context)
    },
    onSuccess: ({ selectedProfileId }) => {
      setProvidersState(queryClient, (current) => ({
        profiles: current?.profiles ?? {},
        selectedProfileId,
      }))
    },
  })
}

export function useSelectProviderProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: selectProviderProfile,
    onMutate: async (id): Promise<ProviderMutationContext> => {
      await queryClient.cancelQueries({ queryKey: providersQueryKey })

      const previousState = getProvidersStateSnapshot(queryClient)

      setProvidersState(queryClient, (current) => ({
        profiles: current?.profiles ?? {},
        selectedProfileId: id,
      }))

      return { previousState }
    },
    onError: (_error, _id, context) => {
      restoreProvidersState(queryClient, context)
    },
    onSuccess: ({ selectedProfileId }) => {
      setProvidersState(queryClient, (current) => ({
        profiles: current?.profiles ?? {},
        selectedProfileId,
      }))
    },
  })
}

export function useSetProviderApiKeyMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, apiKey }: { id: string; apiKey: string }) =>
      setProviderApiKey(id, apiKey),
    onMutate: async ({ id, apiKey }): Promise<ProviderMutationContext> => {
      await queryClient.cancelQueries({ queryKey: providersQueryKey })

      const previousState = getProvidersStateSnapshot(queryClient)

      setProvidersState(queryClient, (current) => {
        const existingProfile = current?.profiles[id]

        if (!existingProfile) {
          return current ?? { profiles: {}, selectedProfileId: null }
        }

        return {
          profiles: {
            ...current.profiles,
            [id]: {
              ...existingProfile,
              hasApiKey: apiKey.trim().length > 0,
            },
          },
          selectedProfileId: current.selectedProfileId,
        }
      })

      return { previousState }
    },
    onError: (_error, _variables, context) => {
      restoreProvidersState(queryClient, context)
    },
    onSuccess: ({ id }) => {
      setProvidersState(queryClient, (current) => {
        const existingProfile = current?.profiles[id]

        if (!existingProfile) {
          return current ?? { profiles: {}, selectedProfileId: null }
        }

        return {
          profiles: {
            ...current.profiles,
            [id]: {
              ...existingProfile,
              hasApiKey: true,
            },
          },
          selectedProfileId: current.selectedProfileId,
        }
      })
    },
  })
}
