import { ProviderProfile, ProviderProfileInput } from "@shared/electron-types"
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
  overrides: Partial<ProviderProfileInput> = {},
): ProviderProfileInput {
  return {
    name: "Groq Primary",
    providerKey: "groq",
    selectedModel: "openai/gpt-oss-120b",
    apiKey: "secret-key",
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

    const profile = await service.addProfile(createProfile())
    const storedProfile: ProviderProfile = {
      id: profileId,
      name: "Groq Primary",
      providerKey: "groq",
      selectedModel: "openai/gpt-oss-120b",
      hasApiKey: true,
    }

    expect(profile).toEqual(storedProfile)
    expect(service.getProfiles()).toEqual({
      [profileId]: storedProfile,
    })
    expect(store.get("providerProfiles")).toEqual({
      [profileId]: storedProfile,
    })
    expect(JSON.stringify(store.get("providerProfiles"))).not.toContain(
      "secret-key",
    )
    expect(store.get("selectedProviderProfileId")).toBe(profileId)
    expect(await service.getApiKey(profile.id)).toBe("secret-key")
  })

  it("updates an existing profile in the store", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const service = new ProviderService(
      new FakeStoreService(),
      new FakeKeytarService(),
    )

    await service.addProfile(createProfile())

    await expect(
      service.updateProfile(profileId, {
        name: "OpenRouter Backup",
        providerKey: "openrouter",
        selectedModel: "openrouter/auto",
        apiKey: "new-secret",
      }),
    ).resolves.toEqual({
      id: profileId,
      name: "OpenRouter Backup",
      providerKey: "openrouter",
      selectedModel: "openrouter/auto",
      hasApiKey: true,
    })
  })

  it("persists a profile without an API key", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const service = new ProviderService(
      new FakeStoreService(),
      new FakeKeytarService(),
    )

    await expect(
      service.addProfile(
        createProfile({
          apiKey: undefined,
        }),
      ),
    ).resolves.toEqual({
      id: profileId,
      name: "Groq Primary",
      providerKey: "groq",
      selectedModel: "openai/gpt-oss-120b",
      hasApiKey: false,
    })
  })

  it("persists a profile without a selected model", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const service = new ProviderService(
      new FakeStoreService(),
      new FakeKeytarService(),
    )

    await expect(
      service.addProfile(
        createProfile({
          selectedModel: undefined,
        }),
      ),
    ).resolves.toEqual({
      id: profileId,
      name: "Groq Primary",
      providerKey: "groq",
      selectedModel: undefined,
      hasApiKey: true,
    })
  })

  it("auto-selects the first incomplete profile", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const store = new FakeStoreService()
    const service = new ProviderService(store, new FakeKeytarService())

    await service.addProfile(
      createProfile({
        apiKey: undefined,
        selectedModel: undefined,
      }),
    )

    expect(store.get("selectedProviderProfileId")).toBe(profileId)
    expect(service.getSelectedProfileId()).toBe(profileId)
  })

  it("throws when updating a missing profile", async () => {
    const service = new ProviderService(
      new FakeStoreService(),
      new FakeKeytarService(),
    )

    await expect(
      service.updateProfile(profileId, {
        name: "Missing Profile",
        providerKey: "groq",
        selectedModel: "openai/gpt-oss-120b",
      }),
    ).rejects.toThrow(`Provider profile "${profileId}" was not found.`)
  })

  it("allows changing provider without a replacement API key and clears hasApiKey", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const service = new ProviderService(
      new FakeStoreService(),
      new FakeKeytarService(),
    )

    await service.addProfile(createProfile())

    await expect(
      service.updateProfile(profileId, {
        providerKey: "openrouter",
      }),
    ).resolves.toEqual({
      id: profileId,
      name: "Groq Primary",
      providerKey: "openrouter",
      selectedModel: "openai/gpt-oss-120b",
      hasApiKey: false,
    })
  })

  it("updates the name and clears hasApiKey when apiKey is omitted", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const service = new ProviderService(
      new FakeStoreService(),
      new FakeKeytarService(),
    )

    await service.addProfile(createProfile())

    await expect(
      service.updateProfile(profileId, {
        name: "Renamed Profile",
      }),
    ).resolves.toEqual({
      id: profileId,
      name: "Renamed Profile",
      providerKey: "groq",
      selectedModel: "openai/gpt-oss-120b",
      hasApiKey: false,
    })
  })

  it("removes a profile and deletes its stored API key", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const store = new FakeStoreService()
    const keytar = new FakeKeytarService()
    const service = new ProviderService(store, keytar)

    const profile = await service.addProfile(createProfile())

    await service.removeProfile(profile.id)

    expect(service.getProfiles()).toEqual({})
    expect(store.get("providerProfiles")).toEqual({})
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

  it("persists an explicitly selected profile", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const store = new FakeStoreService()
    const service = new ProviderService(store, new FakeKeytarService())

    await service.addProfile(createProfile())
    vi.spyOn(crypto, "randomUUID").mockReturnValue(openRouterProfileId)
    const profile = await service.addProfile(
      createProfile({
        name: "OpenRouter",
        providerKey: "openrouter",
        selectedModel: "openrouter/auto",
        apiKey: "openrouter-secret",
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

  it("falls back to the alphabetically first profile when the selected profile is deleted", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const store = new FakeStoreService()
    const service = new ProviderService(store, new FakeKeytarService())
    const firstProfile = await service.addProfile(
      createProfile({ name: "Alpha Profile" }),
    )

    vi.spyOn(crypto, "randomUUID").mockReturnValue(openRouterProfileId)
    const secondProfile = await service.addProfile(
      createProfile({
        name: "Zulu Profile",
        providerKey: "openrouter",
        selectedModel: "openrouter/auto",
        apiKey: "openrouter-secret",
      }),
    )
    service.setSelectedProfileId(secondProfile.id)

    await service.removeProfile(secondProfile.id)

    expect(service.getSelectedProfileId()).toBe(firstProfile.id)
    expect(store.get("selectedProviderProfileId")).toBe(firstProfile.id)
  })

  it("normalizes an invalid stored selected profile id to the alphabetically first profile", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const store = new FakeStoreService()
    const service = new ProviderService(store, new FakeKeytarService())
    const firstProfile = await service.addProfile(
      createProfile({ name: "Alpha Profile" }),
    )
    vi.spyOn(crypto, "randomUUID").mockReturnValue(openRouterProfileId)
    await service.addProfile(
      createProfile({
        name: "Zulu Profile",
        providerKey: "openrouter",
        selectedModel: "openrouter/auto",
        apiKey: "openrouter-secret",
      }),
    )
    store.set("selectedProviderProfileId", "missing-profile-id")

    expect(service.getSelectedProfileId()).toBe(firstProfile.id)
    expect(store.get("selectedProviderProfileId")).toBe(firstProfile.id)
  })

  it("stores hasApiKey as true before the password is saved when an apiKey is provided", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

    const store = new FakeStoreService()
    const keytar = new FakeKeytarService()
    const service = new ProviderService(store, keytar)

    const originalSetApiKey = service.setApiKey.bind(service)
    vi.spyOn(service, "setApiKey").mockImplementation(async (id, apiKey) => {
      expect(store.get("providerProfiles")).toEqual({
        [id]: {
          id,
          name: "Groq Primary",
          providerKey: "groq",
          selectedModel: "openai/gpt-oss-120b",
          hasApiKey: true,
        },
      })

      await originalSetApiKey(id, apiKey)
    })

    await service.addProfile(createProfile())
  })
})
