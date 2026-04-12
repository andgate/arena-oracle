import { AppSettings } from "@shared/electron-types"
import { ProviderProfile } from "@shared/provider-profile-types"

export type StoredProviderProfile = Omit<ProviderProfile, "apiKey">

export interface ProviderStoreState {
  providerProfiles: Record<string, StoredProviderProfile>
  selectedProviderProfileId: string | null
}

export type AppStoreSchema = AppSettings & ProviderStoreState
