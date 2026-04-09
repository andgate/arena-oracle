import {
  ProviderProfile,
  ProviderProfileInput,
  type AppStoreSchema,
} from "@shared/electron-types"
import { inject, injectable, singleton } from "tsyringe"
import { IKeytarService } from "../keytar/KeytarService.interface"
import { IStoreService } from "../store/StoreService.interface"
import { IProviderService } from "./ProviderService.interface"

const KEYTAR_SERVICE_NAME = "arena-oracle.providers"

const defined = <T extends object>(obj: T) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>

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

  async addProfile(profile: ProviderProfileInput): Promise<ProviderProfile> {
    const nextProfile: ProviderProfile = {
      id: crypto.randomUUID(),
      hasApiKey: !!profile.apiKey?.trim(),
      ...defined({
        name: profile.name,
        providerKey: profile.providerKey,
        selectedModel: profile.selectedModel,
      }),
    }

    this.storeProfilesById({
      ...this.storeService.get("providerProfiles"),
      [nextProfile.id]: nextProfile,
    })

    if (!this.storeService.get("selectedProviderProfileId")) {
      this.storeSelectedProfileId(nextProfile.id)
    }

    if (profile.apiKey?.trim()) {
      await this.setApiKey(nextProfile.id, profile.apiKey)
    }

    return this.getProfileById(nextProfile.id)
  }

  async updateProfile(
    id: string,
    updates: ProviderProfileInput,
  ): Promise<ProviderProfile> {
    const currentProfile = this.getProfileById(id)
    const nextApiKey = updates.apiKey?.trim()

    this.storeProfilesById({
      ...this.storeService.get("providerProfiles"),
      [id]: {
        ...currentProfile,
        hasApiKey: !!nextApiKey,
        ...defined({
          name: updates.name,
          providerKey: updates.providerKey,
          selectedModel: updates.selectedModel,
        }),
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

    await this.keytarService.setPassword(KEYTAR_SERVICE_NAME, id, trimmedApiKey)
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

    const fallbackProfileId = Object.values(profiles)[0]?.id ?? null

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
