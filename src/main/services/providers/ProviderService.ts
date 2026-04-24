import {
  ProviderKey,
  ProviderProfile,
  ProviderProfileInput,
} from "@shared/provider-profile-types"
import { isUndefined, mapAsync, omitBy } from "es-toolkit"
import { inject, injectable, singleton } from "tsyringe"
import { IKeytarService } from "../keytar/KeytarService.interface"
import { StoredProviderProfile } from "../store/app-store-schema"
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

  async getProfiles(): Promise<Record<string, ProviderProfile>> {
    const storedProfiles = this.storeService.get("providerProfiles")
    const profiles = await mapAsync(
      Object.entries(storedProfiles),
      async ([id, profile]) => {
        const apiKey = (await this.getApiKey(id)) ?? undefined

        return [id, { ...profile, apiKey }]
      },
      { concurrency: 5 },
    )

    return Object.fromEntries(profiles)
  }

  async createProfile(initial: ProviderProfileInput = {}): Promise<string> {
    const { apiKey, ...initialProfile } = initial
    const nextProfile: StoredProviderProfile = {
      id: crypto.randomUUID(),
      ...omitBy(initialProfile, isUndefined),
    }

    this.storeService.set("providerProfiles", {
      ...this.storeService.get("providerProfiles"),
      [nextProfile.id]: nextProfile,
    })

    if (!this.storeService.get("selectedProviderProfileId")) {
      this.storeService.set("selectedProviderProfileId", nextProfile.id)
    }

    await this.syncProfileApiKey(nextProfile.id, apiKey)

    return nextProfile.id
  }

  async setProfileName(id: string, name: string): Promise<void> {
    this.assertProfileExists(id)
    this.storeService.set(`providerProfiles.${id}.name`, name)
  }

  async setProfileProvider(
    id: string,
    providerKey: ProviderKey,
  ): Promise<void> {
    this.assertProfileExists(id)
    this.storeService.set(`providerProfiles.${id}.providerKey`, providerKey)
  }

  async setProfileModel(id: string, model: string): Promise<void> {
    this.assertProfileExists(id)
    this.storeService.set(`providerProfiles.${id}.selectedModel`, model)
  }

  async setProfileApiKey(id: string, apiKey: string): Promise<void> {
    this.assertProfileExists(id)
    await this.syncProfileApiKey(id, apiKey)
  }

  async deleteProfile(id: string): Promise<void> {
    const profiles = this.storeService.get("providerProfiles")

    if (!profiles[id]) {
      throw new Error(`Provider profile "${id}" was not found.`)
    }

    const nextProfilesById = { ...profiles }
    delete nextProfilesById[id]

    this.storeService.set("providerProfiles", nextProfilesById)
    this.normalizeSelectedProfileId(nextProfilesById)
    await this.keytarService.deletePassword(KEYTAR_SERVICE_NAME, id)
  }

  getSelectedProfileId(): string | null {
    return this.storeService.get("selectedProviderProfileId")
  }

  setSelectedProfileId(id: string): void {
    this.assertProfileExists(id)
    this.storeService.set("selectedProviderProfileId", id)
  }

  private assertProfileExists(id: string): void {
    if (!this.storeService.get("providerProfiles")[id]) {
      throw new Error(`Provider profile "${id}" was not found.`)
    }
  }

  private async getApiKey(profileId: string): Promise<string | null> {
    return this.keytarService.getPassword(KEYTAR_SERVICE_NAME, profileId)
  }

  private normalizeSelectedProfileId(
    profiles: Record<string, StoredProviderProfile>,
  ) {
    const selectedProfileId = this.storeService.get("selectedProviderProfileId")
    if (selectedProfileId && profiles[selectedProfileId]) {
      return
    }

    const fallbackProfileId = Object.keys(profiles)[0] ?? null
    this.storeService.set("selectedProviderProfileId", fallbackProfileId)
  }

  private async syncProfileApiKey(
    profileId: string,
    apiKey: string | undefined,
  ): Promise<void> {
    const trimmedApiKey = apiKey?.trim()

    if (!trimmedApiKey) {
      await this.keytarService.deletePassword(KEYTAR_SERVICE_NAME, profileId)
      return
    }

    await this.keytarService.setPassword(
      KEYTAR_SERVICE_NAME,
      profileId,
      trimmedApiKey,
    )
  }
}
