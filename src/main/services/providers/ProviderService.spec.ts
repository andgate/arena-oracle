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

  describe("createProfile", () => {
    it("stores metadata only and returns the new profile id", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const store = new FakeStoreService()
      const keytar = new FakeKeytarService()
      const service = new ProviderService(store, keytar)

      const result = await service.createProfile(createProfile())
      const storedProfile: StoredProviderProfile = {
        id: profileId,
        name: "Groq Primary",
        providerKey: "groq",
        selectedModel: "openai/gpt-oss-120b",
      }
      const fullProfile: ProviderProfile = {
        ...storedProfile,
        apiKey: "secret-key",
      }
      const profiles = await service.getProfiles()
      const password = await keytar.getPassword(keytarServiceName, profileId)

      expect(result).toBe(profileId)
      expect(profiles).toEqual({
        [profileId]: fullProfile,
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

    it("supports incomplete profiles", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const service = new ProviderService(
        new FakeStoreService(),
        new FakeKeytarService(),
      )

      const result = await service.createProfile()
      const profiles = await service.getProfiles()

      expect(result).toBe(profileId)
      expect(profiles[profileId]).toEqual({
        id: profileId,
      })
    })

    it("keeps the existing selection when profiles already exist", async () => {
      const store = new FakeStoreService()
      const service = new ProviderService(store, new FakeKeytarService())

      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)
      await service.createProfile({})

      vi.spyOn(crypto, "randomUUID").mockReturnValue(openRouterProfileId)
      const result = await service.createProfile({})

      expect(result).toBe(openRouterProfileId)
      expect(store.get("selectedProviderProfileId")).toBe(profileId)
    })
  })

  describe("getProfiles", () => {
    it("returns all profiles with their API keys", async () => {
      const keytar = new FakeKeytarService()
      const service = new ProviderService(new FakeStoreService(), keytar)

      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)
      await service.createProfile(createProfile())

      vi.spyOn(crypto, "randomUUID").mockReturnValue(openRouterProfileId)
      await service.createProfile(
        createProfile({
          name: "OpenRouter",
          providerKey: "openrouter",
          selectedModel: "openrouter/auto",
          apiKey: "openrouter-secret",
        }),
      )

      const profiles = await service.getProfiles()

      expect(Object.keys(profiles)).toHaveLength(2)
      expect(profiles[profileId]?.apiKey).toBe("secret-key")
      expect(profiles[openRouterProfileId]?.apiKey).toBe("openrouter-secret")
    })
  })

  describe("setProfileName", () => {
    it("updates an existing profile name", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const service = new ProviderService(
        new FakeStoreService(),
        new FakeKeytarService(),
      )

      await service.createProfile(createProfile())

      await service.setProfileName(profileId, "OpenRouter Backup")
      const profiles = await service.getProfiles()

      expect(profiles[profileId].name).toEqual("OpenRouter Backup")
    })

    it("throws when the profile does not exist", async () => {
      const service = new ProviderService(
        new FakeStoreService(),
        new FakeKeytarService(),
      )

      await expect(
        service.setProfileName(profileId, "Missing Profile"),
      ).rejects.toThrow(`Provider profile "${profileId}" was not found.`)
    })
  })

  describe("setProfileProvider", () => {
    it("updates the provider key", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const service = new ProviderService(
        new FakeStoreService(),
        new FakeKeytarService(),
      )

      await service.createProfile(createProfile())

      await service.setProfileProvider(profileId, "openrouter")
      const profiles = await service.getProfiles()

      expect(profiles[profileId]?.providerKey).toBe("openrouter")
    })

    it("throws when the profile does not exist", async () => {
      const service = new ProviderService(
        new FakeStoreService(),
        new FakeKeytarService(),
      )

      await expect(
        service.setProfileProvider(profileId, "openrouter"),
      ).rejects.toThrow(`Provider profile "${profileId}" was not found.`)
    })
  })

  describe("setProfileModel", () => {
    it("updates the selected model", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const service = new ProviderService(
        new FakeStoreService(),
        new FakeKeytarService(),
      )

      await service.createProfile(createProfile())

      await service.setProfileModel(profileId, "openrouter/auto")
      const profiles = await service.getProfiles()

      expect(profiles[profileId]?.selectedModel).toBe("openrouter/auto")
    })

    it("throws when the profile does not exist", async () => {
      const service = new ProviderService(
        new FakeStoreService(),
        new FakeKeytarService(),
      )

      await expect(
        service.setProfileModel(profileId, "openrouter/auto"),
      ).rejects.toThrow(`Provider profile "${profileId}" was not found.`)
    })
  })

  describe("setProfileApiKey", () => {
    it("replaces the stored API key", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const keytar = new FakeKeytarService()
      const service = new ProviderService(new FakeStoreService(), keytar)

      await service.createProfile(createProfile())

      await service.setProfileApiKey(profileId, "new-secret")
      const profiles = await service.getProfiles()
      const password = await keytar.getPassword(keytarServiceName, profileId)

      expect(profiles[profileId]?.apiKey).toBe("new-secret")
      expect(password).toBe("new-secret")
    })

    it("deletes the stored API key when it is blank", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const keytar = new FakeKeytarService()
      const service = new ProviderService(new FakeStoreService(), keytar)

      await service.createProfile(createProfile())

      await service.setProfileApiKey(profileId, "")
      const profiles = await service.getProfiles()
      const password = await keytar.getPassword(keytarServiceName, profileId)

      expect(profiles[profileId]?.apiKey).toBeUndefined()
      expect(password).toBe(null)
    })

    it("throws when the profile does not exist", async () => {
      const service = new ProviderService(
        new FakeStoreService(),
        new FakeKeytarService(),
      )

      await expect(
        service.setProfileApiKey(profileId, "new-secret"),
      ).rejects.toThrow(`Provider profile "${profileId}" was not found.`)
    })
  })

  describe("deleteProfile", () => {
    it("removes a profile and deletes its stored API key", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const store = new FakeStoreService()
      const keytar = new FakeKeytarService()
      const service = new ProviderService(store, keytar)

      const createdProfileId = await service.createProfile(createProfile())

      await service.deleteProfile(createdProfileId)
      const profiles = await service.getProfiles()
      const password = await keytar.getPassword(
        keytarServiceName,
        createdProfileId,
      )

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

      await expect(service.deleteProfile(profileId)).rejects.toThrow(
        `Provider profile "${profileId}" was not found.`,
      )
    })

    it("keeps the current selection when a non-selected profile is deleted", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const store = new FakeStoreService()
      const service = new ProviderService(store, new FakeKeytarService())
      await service.createProfile(createProfile({ name: "Alpha Profile" }))

      vi.spyOn(crypto, "randomUUID").mockReturnValue(openRouterProfileId)
      const secondProfileId = await service.createProfile(
        createProfile({ name: "Zulu Profile", providerKey: "openrouter" }),
      )

      service.setSelectedProfileId(profileId)
      await service.deleteProfile(secondProfileId)

      expect(service.getSelectedProfileId()).toBe(profileId)
      expect(store.get("selectedProviderProfileId")).toBe(profileId)
    })

    it("falls back to the alphabetically first stored profile order when the selected profile is deleted", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const store = new FakeStoreService()
      const service = new ProviderService(store, new FakeKeytarService())
      const firstProfileId = await service.createProfile(
        createProfile({ name: "Alpha Profile" }),
      )

      vi.spyOn(crypto, "randomUUID").mockReturnValue(openRouterProfileId)
      const secondProfileId = await service.createProfile(
        createProfile({
          name: "Zulu Profile",
          providerKey: "openrouter",
          selectedModel: "openrouter/auto",
          apiKey: "openrouter-secret",
        }),
      )
      service.setSelectedProfileId(secondProfileId)

      await service.deleteProfile(secondProfileId)

      expect(service.getSelectedProfileId()).toBe(firstProfileId)
      expect(store.get("selectedProviderProfileId")).toBe(firstProfileId)
    })
  })

  describe("getSelectedProfileId", () => {
    it("returns the stored selected profile id when it exists", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(profileId)

      const store = new FakeStoreService()
      const service = new ProviderService(store, new FakeKeytarService())

      await service.createProfile(createProfile())
      store.set("selectedProviderProfileId", profileId)

      expect(service.getSelectedProfileId()).toBe(profileId)
      expect(store.get("selectedProviderProfileId")).toBe(profileId)
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

      await service.createProfile(createProfile())
      vi.spyOn(crypto, "randomUUID").mockReturnValue(openRouterProfileId)
      const profile = await service.createProfile(
        createProfile({
          name: "OpenRouter",
          providerKey: "openrouter",
          selectedModel: "openrouter/auto",
          apiKey: "openrouter-secret",
        }),
      )

      service.setSelectedProfileId(profile)
      const selectedProfileId = service.getSelectedProfileId()

      expect(selectedProfileId).toBe(openRouterProfileId)
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
  })
})
