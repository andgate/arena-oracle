import {
  ProviderKey,
  ProviderProfile,
  ProviderProfileInput,
} from "@shared/provider-profile-types"

export const IProviderService = Symbol("IProviderService")

export interface IProviderService {
  getProfiles(): Promise<Record<string, ProviderProfile>>
  createProfile(initial?: ProviderProfileInput): Promise<string>
  setProfileName(id: string, name: string): Promise<void>
  setProfileProvider(id: string, providerKey: ProviderKey): Promise<void>
  setProfileModel(id: string, model: string): Promise<void>
  setProfileApiKey(id: string, apiKey: string): Promise<void>
  deleteProfile(id: string): Promise<void>
  getSelectedProfileId(): string | null
  setSelectedProfileId(id: string): void
}
