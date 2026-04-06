import {
  CreateProviderProfileInput,
  ProviderProfile,
  UpdateProviderProfileInput,
  type AppStoreSchema,
} from "@shared/electron-types"
import { inject, injectable, singleton } from "tsyringe"
import { IKeytarService } from "../keytar/KeytarService.interface"
import { IStoreService } from "../store/StoreService.interface"
import { IProviderService } from "./ProviderService.interface"

const KEYTAR_SERVICE_NAME = "arena-oracle.providers"

@injectable()
@singleton()
export class ProviderService implements IProviderService {
  constructor(
    @inject(IStoreService) private readonly storeService: IStoreService,
    @inject(IKeytarService) private readonly keytarService: IKeytarService,
  ) {}

  getProfiles(): Record<string, ProviderProfile> {
    return this.storeService.get("providerProfiles")
  }

  async addProfile(
    profile: CreateProviderProfileInput,
  ): Promise<ProviderProfile> {
    const apiKey = profile.apiKey.trim()

    if (!apiKey) {
      throw new Error("Provider profiles require an API key.")
    }

    const nextProfile: ProviderProfile = {
      id: crypto.randomUUID(),
      name: profile.name,
      providerKey: profile.providerKey,
      selectedModel: profile.selectedModel,
      hasApiKey: false,
    }

    this.storeProfilesById({
      ...this.storeService.get("providerProfiles"),
      [nextProfile.id]: nextProfile,
    })

    if (!this.storeService.get("selectedProviderProfileId")) {
      this.storeSelectedProfileId(nextProfile.id)
    }

    await this.setApiKey(nextProfile.id, apiKey)

    return this.getProfileById(nextProfile.id)
  }

  async updateProfile(
    id: string,
    updates: UpdateProviderProfileInput,
  ): Promise<ProviderProfile> {
    const currentProfile = this.getProfileById(id)
    const providerChanged = currentProfile.providerKey !== updates.providerKey
    const nextApiKey = updates.apiKey?.trim()

    if (providerChanged && !nextApiKey) {
      throw new Error("Changing provider requires a new API key.")
    }

    this.storeProfilesById({
      ...this.storeService.get("providerProfiles"),
      [id]: {
        id,
        name: updates.name,
        providerKey: updates.providerKey,
        selectedModel: updates.selectedModel,
        hasApiKey: providerChanged ? false : currentProfile.hasApiKey,
      },
    })

    if (nextApiKey) {
      await this.setApiKey(id, nextApiKey)
    }

    return this.getProfileById(id)
  }

  async removeProfile(id: string): Promise<void> {
    const profiles = this.storeService.get("providerProfiles")

    if (!profiles[id]) {
      throw new Error(`Provider profile "${id}" was not found.`)
    }

    const nextProfilesById = { ...profiles }
    delete nextProfilesById[id]

    this.storeProfilesById(nextProfilesById)
    this.normalizeSelectedProfileId(nextProfilesById)
    await this.keytarService.deletePassword(KEYTAR_SERVICE_NAME, id)
  }

  getSelectedProfileId(): string | null {
    return this.normalizeSelectedProfileId(
      this.storeService.get("providerProfiles"),
    )
  }

  setSelectedProfileId(id: string): void {
    this.getProfileById(id)
    this.storeSelectedProfileId(id)
  }

  async getApiKey(id: string): Promise<string | null> {
    this.getProfileById(id)

    return this.keytarService.getPassword(KEYTAR_SERVICE_NAME, id)
  }

  async setApiKey(id: string, apiKey: string): Promise<void> {
    const trimmedApiKey = apiKey.trim()

    if (!trimmedApiKey) {
      throw new Error("Provider profiles require an API key.")
    }

    const profile = this.getProfileById(id)
    await this.keytarService.setPassword(KEYTAR_SERVICE_NAME, id, trimmedApiKey)

    this.storeProfilesById({
      ...this.storeService.get("providerProfiles"),
      [id]: {
        ...profile,
        hasApiKey: true,
      },
    })
  }

  private getProfileById(id: string): ProviderProfile {
    const profile = this.storeService.get("providerProfiles")[id]

    if (!profile) {
      throw new Error(`Provider profile "${id}" was not found.`)
    }

    return profile
  }

  private normalizeSelectedProfileId(
    profiles: Record<string, ProviderProfile>,
  ): string | null {
    const selectedProfileId = this.storeService.get("selectedProviderProfileId")

    if (selectedProfileId && profiles[selectedProfileId]) {
      return selectedProfileId
    }

    const fallbackProfileId =
      Object.values(profiles).sort((a, b) =>
        a.name.localeCompare(b.name),
      )[0]?.id ?? null
    this.storeSelectedProfileId(fallbackProfileId)

    return fallbackProfileId
  }

  private storeProfilesById(
    profiles: AppStoreSchema["providerProfiles"],
  ): void {
    this.storeService.set("providerProfiles", profiles)
  }

  private storeSelectedProfileId(
    selectedProfileId: AppStoreSchema["selectedProviderProfileId"],
  ): void {
    this.storeService.set("selectedProviderProfileId", selectedProfileId)
  }
}
