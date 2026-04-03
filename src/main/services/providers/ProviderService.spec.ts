import { ProviderProfile } from "@shared/electron-types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { IKeytarService } from "../keytar/KeytarService.interface"
import { FakeStoreService } from "../store/StoreService.mock"
import { ProviderService } from "./ProviderService"

class FakeKeytarService implements IKeytarService {
  private passwords = new Map<string, string>()

  async getPassword(service: string, account: string): Promise<string | null> {
    return this.passwords.get(`${service}:${account}`) ?? null
  }

  async setPassword(
    service: string,
    account: string,
    password: string,
  ): Promise<void> {
    this.passwords.set(`${service}:${account}`, password)
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    return this.passwords.delete(`${service}:${account}`)
  }
}

function createProfile(
  overrides: Partial<Omit<ProviderProfile, "id">> = {},
): Omit<ProviderProfile, "id"> {
  return {
    name: "Groq Primary",
    providerKey: "groq",
    selectedModel: "openai/gpt-oss-120b",
    ...overrides,
  }
}

describe("ProviderService", () => {
  const profileId = "11111111-1111-1111-1111-111111111111"
  const openRouterProfileId = "22222222-2222-2222-2222-222222222222"

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("stores and returns profiles without persisting API keys in the store", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const store = new FakeStoreService()
    const keytar = new FakeKeytarService()
    const service = new ProviderService(store, keytar)

    const profile = service.addProfile(createProfile())
    await service.setApiKey(profile.id, "secret-key")

    expect(profile).toEqual({
      id: profileId,
      name: "Groq Primary",
      providerKey: "groq",
      selectedModel: "openai/gpt-oss-120b",
    })
    expect(service.getProfiles()).toEqual([profile])
    expect(store.get("providerProfiles")).toEqual([profile])
    expect(JSON.stringify(store.get("providerProfiles"))).not.toContain(
      "secret-key",
    )
    expect(store.get("selectedProviderProfileId")).toBe(profileId)
    expect(await service.getApiKey(profile.id)).toBe("secret-key")
  })

  it("updates an existing profile in the store", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const service = new ProviderService(
      new FakeStoreService(),
      new FakeKeytarService(),
    )

    service.addProfile(createProfile())

    expect(
      service.updateProfile(profileId, {
        name: "OpenRouter Backup",
        providerKey: "openrouter",
        selectedModel: "openrouter/auto",
      }),
    ).toEqual({
      id: profileId,
      name: "OpenRouter Backup",
      providerKey: "openrouter",
      selectedModel: "openrouter/auto",
    })
  })

  it("throws when updating a missing profile", () => {
    const service = new ProviderService(
      new FakeStoreService(),
      new FakeKeytarService(),
    )

    expect(() =>
      service.updateProfile(profileId, {
        name: "Missing Profile",
      }),
    ).toThrow(`Provider profile "${profileId}" was not found.`)
  })

  it("removes a profile and deletes its stored API key", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const store = new FakeStoreService()
    const keytar = new FakeKeytarService()
    const service = new ProviderService(store, keytar)

    const profile = service.addProfile(createProfile())
    await service.setApiKey(profile.id, "secret-key")

    await service.removeProfile(profile.id)

    expect(service.getProfiles()).toEqual([])
    expect(store.get("providerProfiles")).toEqual([])
    expect(service.getSelectedProfileId()).toBe(null)
    await expect(service.getApiKey(profile.id)).rejects.toThrow(
      `Provider profile "${profileId}" was not found.`,
    )
  })

  it("throws when removing a missing profile", async () => {
    const service = new ProviderService(
      new FakeStoreService(),
      new FakeKeytarService(),
    )

    await expect(service.removeProfile(profileId)).rejects.toThrow(
      `Provider profile "${profileId}" was not found.`,
    )
  })

  it("persists an explicitly selected profile", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const store = new FakeStoreService()
    const service = new ProviderService(store, new FakeKeytarService())

    service.addProfile(createProfile())
    vi.spyOn(crypto, "randomUUID").mockReturnValue(openRouterProfileId)
    const profile = service.addProfile(
      createProfile({
        name: "OpenRouter",
        providerKey: "openrouter",
        selectedModel: "openrouter/auto",
      }),
    )

    service.setSelectedProfileId(profile.id)
    expect(store.get("selectedProviderProfileId")).toBe(openRouterProfileId)
  })

  it("throws when setting the selected profile to a missing id", () => {
    const service = new ProviderService(
      new FakeStoreService(),
      new FakeKeytarService(),
    )

    expect(() => service.setSelectedProfileId(profileId)).toThrow(
      `Provider profile "${profileId}" was not found.`,
    )
  })

  it("falls back to the first profile when the selected profile is deleted", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const store = new FakeStoreService()
    const service = new ProviderService(store, new FakeKeytarService())
    const firstProfile = service.addProfile(createProfile())

    vi.spyOn(crypto, "randomUUID").mockReturnValue(openRouterProfileId)
    const secondProfile = service.addProfile(
      createProfile({
        name: "OpenRouter",
        providerKey: "openrouter",
        selectedModel: "openrouter/auto",
      }),
    )
    service.setSelectedProfileId(secondProfile.id)

    await service.removeProfile(secondProfile.id)

    expect(service.getSelectedProfileId()).toBe(firstProfile.id)
    expect(store.get("selectedProviderProfileId")).toBe(firstProfile.id)
  })

  it("normalizes an invalid stored selected profile id to the first profile", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const store = new FakeStoreService()
    const service = new ProviderService(store, new FakeKeytarService())
    const profile = service.addProfile(createProfile())
    store.set("selectedProviderProfileId", "missing-profile-id")

    expect(service.getSelectedProfileId()).toBe(profile.id)
    expect(store.get("selectedProviderProfileId")).toBe(profile.id)
  })
})
