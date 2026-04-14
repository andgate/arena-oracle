import {
  ProviderProfile,
  ProviderProfileInput,
} from "@shared/provider-profile-types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { IKeytarService } from "../keytar/KeytarService.interface"
import { StoredProviderProfile } from "../store/app-store-schema"
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
  const keytarServiceName = "arena-oracle.providers"

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe("addProfile", () => {
    it("stores metadata only and returns hydrated profiles with API keys", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const store = new FakeStoreService()
      const keytar = new FakeKeytarService()
      const service = new ProviderService(store, keytar)

      const profile = await service.addProfile(createProfile())
      const storedProfile: StoredProviderProfile = {
        id: profileId,
        name: "Groq Primary",
        providerKey: "groq",
        selectedModel: "openai/gpt-oss-120b",
      }
      const hydratedProfile: ProviderProfile = {
        ...storedProfile,
        apiKey: "secret-key",
      }
      const profiles = await service.getProfiles()
      const password = await keytar.getPassword(keytarServiceName, profile.id)

      expect(profile).toEqual(hydratedProfile)
      expect(profiles).toEqual({
        [profileId]: hydratedProfile,
      })
      expect(store.get("providerProfiles")).toEqual({
        [profileId]: storedProfile,
      })
      expect(JSON.stringify(store.get("providerProfiles"))).not.toContain(
        "secret-key",
      )
      expect(store.get("selectedProviderProfileId")).toBe(profileId)
      expect(password).toBe("secret-key")
    })

    it("persists a profile without a name", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const service = new ProviderService(
        new FakeStoreService(),
        new FakeKeytarService(),
      )

      const profile = await service.addProfile(
        createProfile({
          name: undefined,
        }),
      )

      expect(profile).not.toHaveProperty("name")
    })

    it("persists a profile without a provider key", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const service = new ProviderService(
        new FakeStoreService(),
        new FakeKeytarService(),
      )

      const profile = await service.addProfile(
        createProfile({
          providerKey: undefined,
        }),
      )

      expect(profile).not.toHaveProperty("providerKey")
    })

    it("persists a profile without a selected model", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const service = new ProviderService(
        new FakeStoreService(),
        new FakeKeytarService(),
      )

      const profile = await service.addProfile(
        createProfile({
          selectedModel: undefined,
        }),
      )

      expect(profile).not.toHaveProperty("selectedModel")
    })

    it("persists a profile without an API key", async () => {
      const service = new ProviderService(
        new FakeStoreService(),
        new FakeKeytarService(),
      )

      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)
      const profile = await service.addProfile(
        createProfile({
          apiKey: undefined,
        }),
      )

      expect(profile).toHaveProperty("apiKey")
      expect(profile.apiKey).toBe("")
    })

    it("auto-selects the first incomplete profile", async () => {
      const store = new FakeStoreService()
      const service = new ProviderService(store, new FakeKeytarService())

      // Create first profile
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)
      await service.addProfile({})

      // Create second profile with different id
      vi.spyOn(crypto, "randomUUID").mockReturnValue(openRouterProfileId)
      await service.addProfile({})

      // Expect first profile to be selected
      expect(store.get("selectedProviderProfileId")).toBe(profileId)
      expect(service.getSelectedProfileId()).toBe(profileId)
    })
  })

  describe("getProfiles", () => {
    it("hydrates API keys for all stored profiles", async () => {
      const keytar = new FakeKeytarService()
      const service = new ProviderService(new FakeStoreService(), keytar)

      // Create first profile
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)
      await service.addProfile(createProfile())

      // Create second profile
      vi.spyOn(crypto, "randomUUID").mockReturnValue(openRouterProfileId)
      await service.addProfile(
        createProfile({
          name: "OpenRouter",
          providerKey: "openrouter",
          selectedModel: "openrouter/auto",
          apiKey: "openrouter-secret",
        }),
      )
      // Get profiles map
      const profiles = await service.getProfiles()

      expect(profiles).toEqual({
        [profileId]: {
          id: profileId,
          name: "Groq Primary",
          providerKey: "groq",
          selectedModel: "openai/gpt-oss-120b",
          apiKey: "secret-key",
        },
        [openRouterProfileId]: {
          id: openRouterProfileId,
          name: "OpenRouter",
          providerKey: "openrouter",
          selectedModel: "openrouter/auto",
          apiKey: "openrouter-secret",
        },
      })
    })
  })

  describe("updateProfile", () => {
    it("updates an existing profile and replaces the stored API key", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const keytar = new FakeKeytarService()
      const service = new ProviderService(new FakeStoreService(), keytar)

      await service.addProfile(createProfile())

      const profile = await service.updateProfile(profileId, {
        name: "OpenRouter Backup",
        providerKey: "openrouter",
        selectedModel: "openrouter/auto",
        apiKey: "new-secret",
      })
      const password = await keytar.getPassword(keytarServiceName, profileId)

      expect(profile).toEqual({
        id: profileId,
        name: "OpenRouter Backup",
        providerKey: "openrouter",
        selectedModel: "openrouter/auto",
        apiKey: "new-secret",
      })
      expect(password).toBe("new-secret")
    })

    it("deletes the stored API key when apiKey is undefined", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const keytar = new FakeKeytarService()
      const service = new ProviderService(new FakeStoreService(), keytar)

      await service.addProfile(createProfile())

      const profile = await service.updateProfile(profileId, {
        apiKey: undefined,
      })
      const password = await keytar.getPassword(keytarServiceName, profileId)

      expect(profile.apiKey).toEqual("")
      expect(password).toBe(null)
    })

    it("throws when updating a missing profile", async () => {
      const service = new ProviderService(
        new FakeStoreService(),
        new FakeKeytarService(),
      )
      let error: unknown

      try {
        await service.updateProfile(profileId, {
          name: "Missing Profile",
          providerKey: "groq",
          selectedModel: "openai/gpt-oss-120b",
        })
      } catch (nextError) {
        error = nextError
      }

      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe(
        `Provider profile "${profileId}" was not found.`,
      )
    })
  })

  describe("removeProfile", () => {
    it("removes a profile and deletes its stored API key", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const store = new FakeStoreService()
      const keytar = new FakeKeytarService()
      const service = new ProviderService(store, keytar)

      const profile = await service.addProfile(createProfile())

      await service.removeProfile(profile.id)
      const profiles = await service.getProfiles()
      const password = await keytar.getPassword(keytarServiceName, profile.id)

      expect(profiles).toEqual({})
      expect(store.get("providerProfiles")).toEqual({})
      expect(service.getSelectedProfileId()).toBe(null)
      expect(password).toBe(null)
    })

    it("throws when removing a missing profile", async () => {
      const service = new ProviderService(
        new FakeStoreService(),
        new FakeKeytarService(),
      )
      let error: unknown

      try {
        await service.removeProfile(profileId)
      } catch (nextError) {
        error = nextError
      }

      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe(
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
  })

  describe("getSelectedProfileId", () => {
    it("returns the stored selected profile id when it exists", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const store = new FakeStoreService()
      const service = new ProviderService(store, new FakeKeytarService())

      await service.addProfile(createProfile())
      store.set("selectedProviderProfileId", profileId)

      expect(service.getSelectedProfileId()).toBe(profileId)
      expect(store.get("selectedProviderProfileId")).toBe(profileId)
    })

    it("normalizes an invalid stored selected profile id to the alphabetically first profile", async () => {
      const store = new FakeStoreService()
      const service = new ProviderService(store, new FakeKeytarService())

      // Add a profile
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)
      const firstProfile = await service.addProfile(
        createProfile({ name: "Alpha Profile" }),
      )
      // Add a second profile
      vi.spyOn(crypto, "randomUUID").mockReturnValue(openRouterProfileId)
      await service.addProfile(
        createProfile({
          name: "Zulu Profile",
          providerKey: "openrouter",
          selectedModel: "openrouter/auto",
          apiKey: "openrouter-secret",
        }),
      )
      // Set selected profile to a non-existent id
      store.set("selectedProviderProfileId", "missing-profile-id")

      expect(service.getSelectedProfileId()).toBe(firstProfile.id)
      expect(store.get("selectedProviderProfileId")).toBe(firstProfile.id)
    })

    it("returns null when no profiles exist", () => {
      const store = new FakeStoreService()
      const service = new ProviderService(store, new FakeKeytarService())

      expect(service.getSelectedProfileId()).toBe(null)
      expect(store.get("selectedProviderProfileId")).toBe(null)
    })
  })

  describe("setSelectedProfileId", () => {
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
      const selectedProfileId = service.getSelectedProfileId()

      expect(selectedProfileId).toBe(openRouterProfileId)
      expect(store.get("selectedProviderProfileId")).toBe(openRouterProfileId)
    })

    it("throws when setting the selected profile to a missing id", () => {
      const service = new ProviderService(
        new FakeStoreService(),
        new FakeKeytarService(),
      )
      let error: unknown

      try {
        service.setSelectedProfileId(profileId)
      } catch (nextError) {
        error = nextError
      }

      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe(
        `Provider profile "${profileId}" was not found.`,
      )
    })
  })
})
