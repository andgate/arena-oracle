import { ProviderProfile, ProviderProfileInput } from "@shared/provider-profile-types"

export const IProviderService = Symbol("IProviderService")

export interface IProviderService {
  getProfiles(): Promise<Record<string, ProviderProfile>>
  addProfile(profile: ProviderProfileInput): Promise<ProviderProfile>
  updateProfile(
    id: string,
    updates: ProviderProfileInput,
  ): Promise<ProviderProfile>
  removeProfile(id: string): Promise<void>
  getSelectedProfileId(): string | null
  setSelectedProfileId(id: string): void
}
