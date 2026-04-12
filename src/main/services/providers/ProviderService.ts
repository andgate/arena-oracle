import {
  ProviderProfile,
  ProviderProfileInput,
} from "@shared/provider-profile-types"
import { inject, injectable, singleton } from "tsyringe"
import { IKeytarService } from "../keytar/KeytarService.interface"
import {
  AppStoreSchema,
  StoredProviderProfile,
} from "../store/app-store-schema"
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

  async getProfiles(): Promise<Record<string, ProviderProfile>> {
    const storedProfiles = this.storeService.get("providerProfiles")
    const hydratedProfiles = await Promise.all(
      Object.entries(storedProfiles).map(async ([id, profile]) => [
        id,
        await this.hydrateProfile(profile),
      ]),
    )

    return Object.fromEntries(hydratedProfiles)
  }

  async addProfile(profile: ProviderProfileInput): Promise<ProviderProfile> {
    const nextProfile: StoredProviderProfile = {
      id: crypto.randomUUID(),
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

    await this.keytarService.setPassword(
      KEYTAR_SERVICE_NAME,
      nextProfile.id,
      profile.apiKey?.trim() ?? "",
    )

    return this.getProfileById(nextProfile.id)
  }

  async updateProfile(
    id: string,
    updates: ProviderProfileInput,
  ): Promise<ProviderProfile> {
    const currentProfile = this.getStoredProfileById(id)
    this.storeProfilesById({
      ...this.storeService.get("providerProfiles"),
      [id]: {
        ...currentProfile,
        ...defined({
          name: updates.name,
          providerKey: updates.providerKey,
          selectedModel: updates.selectedModel,
        }),
      },
    })
    await this.keytarService.setPassword(
      KEYTAR_SERVICE_NAME,
      id,
      updates.apiKey?.trim() ?? "",
    )

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
    this.getStoredProfileById(id)
    this.storeSelectedProfileId(id)
  }

  private async getProfileById(id: string): Promise<ProviderProfile> {
    return this.hydrateProfile(this.getStoredProfileById(id))
  }

  private getStoredProfileById(id: string): StoredProviderProfile {
    const profile = this.storeService.get("providerProfiles")[id]

    if (!profile) {
      throw new Error(`Provider profile "${id}" was not found.`)
    }

    return profile
  }

  private async hydrateProfile(
    profile: StoredProviderProfile,
  ): Promise<ProviderProfile> {
    const rawApiKey = await this.keytarService.getPassword(
      KEYTAR_SERVICE_NAME,
      profile.id,
    )
    const apiKey = rawApiKey ?? ""

    return { ...profile, apiKey }
  }

  private normalizeSelectedProfileId(
    profiles: Record<string, StoredProviderProfile>,
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
