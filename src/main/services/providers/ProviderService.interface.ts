import { ProviderProfile } from "@shared/electron-types"

export const IProviderService = Symbol("IProviderService")

export interface IProviderService {
  getProfiles(): ProviderProfile[]
  addProfile(profile: Omit<ProviderProfile, "id">): ProviderProfile
  updateProfile(
    id: string,
    updates: Partial<Omit<ProviderProfile, "id">>,
  ): ProviderProfile
  removeProfile(id: string): Promise<void>
  getSelectedProfileId(): string | null
  setSelectedProfileId(id: string): void
  getApiKey(id: string): Promise<string | null>
  setApiKey(id: string, apiKey: string): Promise<void>
}
