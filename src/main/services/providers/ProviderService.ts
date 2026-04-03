import { ProviderProfile, type AppStoreSchema } from "@shared/electron-types"
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

  getProfiles(): ProviderProfile[] {
    return [...this.storeService.get("providerProfiles")]
  }

  addProfile(profile: Omit<ProviderProfile, "id">): ProviderProfile {
    const nextProfile: ProviderProfile = {
      ...profile,
      id: crypto.randomUUID(),
    }

    const profiles = [...this.getProfiles(), nextProfile]
    this.storeProfiles(profiles)

    if (!this.storeService.get("selectedProviderProfileId")) {
      this.storeSelectedProfileId(nextProfile.id)
    }

    return nextProfile
  }

  updateProfile(
    id: string,
    updates: Partial<Omit<ProviderProfile, "id">>,
  ): ProviderProfile {
    const profiles = this.getProfiles()
    const index = profiles.findIndex((profile) => profile.id === id)

    if (index < 0) {
      throw new Error(`Provider profile "${id}" was not found.`)
    }

    const nextProfile = {
      ...profiles[index],
      ...updates,
      id,
    }

    profiles[index] = nextProfile
    this.storeProfiles(profiles)

    return nextProfile
  }

  async removeProfile(id: string): Promise<void> {
    const profiles = this.getProfiles()
    const nextProfiles = profiles.filter((profile) => profile.id !== id)

    if (nextProfiles.length === profiles.length) {
      throw new Error(`Provider profile "${id}" was not found.`)
    }

    this.storeProfiles(nextProfiles)
    this.normalizeSelectedProfileId(nextProfiles)
    await this.keytarService.deletePassword(KEYTAR_SERVICE_NAME, id)
  }

  getSelectedProfileId(): string | null {
    return this.normalizeSelectedProfileId(this.getProfiles())
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
    this.getProfileById(id)
    await this.keytarService.setPassword(KEYTAR_SERVICE_NAME, id, apiKey)
  }

  private getProfileById(id: string): ProviderProfile {
    const profile = this.getProfiles().find((candidate) => candidate.id === id)

    if (!profile) {
      throw new Error(`Provider profile "${id}" was not found.`)
    }

    return profile
  }

  private normalizeSelectedProfileId(
    profiles: ProviderProfile[],
  ): string | null {
    const selectedProfileId = this.storeService.get("selectedProviderProfileId")

    if (
      selectedProfileId &&
      profiles.some((profile) => profile.id === selectedProfileId)
    ) {
      return selectedProfileId
    }

    const fallbackProfileId = profiles[0]?.id ?? null
    this.storeSelectedProfileId(fallbackProfileId)

    return fallbackProfileId
  }

  private storeProfiles(profiles: AppStoreSchema["providerProfiles"]): void {
    this.storeService.set("providerProfiles", profiles)
  }

  private storeSelectedProfileId(
    selectedProfileId: AppStoreSchema["selectedProviderProfileId"],
  ): void {
    this.storeService.set("selectedProviderProfileId", selectedProfileId)
  }
}
