import {
  CreateProviderProfileInput,
  ProviderProfile,
  UpdateProviderProfileInput,
} from "@shared/electron-types"

export const IProviderService = Symbol("IProviderService")

export interface IProviderService {
  getProfiles(): Record<string, ProviderProfile>
  addProfile(profile: CreateProviderProfileInput): Promise<ProviderProfile>
  updateProfile(
    id: string,
    updates: UpdateProviderProfileInput,
  ): Promise<ProviderProfile>
  removeProfile(id: string): Promise<void>
  getSelectedProfileId(): string | null
  setSelectedProfileId(id: string): void
  getApiKey(id: string): Promise<string | null>
  setApiKey(id: string, apiKey: string): Promise<void>
}
