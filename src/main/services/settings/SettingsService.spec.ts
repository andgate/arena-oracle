import { describe, expect, it } from "vitest"
import { SettingsService } from "./SettingsService"
import { FakeStoreService } from "../store/StoreService.mock"

describe("SettingsService", () => {
  it("returns all settings from the backing store", () => {
    const store = new FakeStoreService()
    store.set("alwaysOnTop", true)
    store.set("developerMode", true)

    const service = new SettingsService(store)

    expect(service.get()).toEqual({
      alwaysOnTop: true,
      developerMode: true,
    })
  })

  it("reads individual settings from the backing store", () => {
    const store = new FakeStoreService()
    store.set("alwaysOnTop", true)

    const service = new SettingsService(store)

    expect(service.getAlwaysOnTop()).toBe(true)
    expect(service.getDeveloperMode()).toBe(false)
  })

  it("writes always-on-top through the backing store", () => {
    const store = new FakeStoreService()
    const service = new SettingsService(store)

    service.setAlwaysOnTop(true)

    expect(store.get("alwaysOnTop")).toBe(true)
  })

  it("writes developer mode through the backing store", () => {
    const store = new FakeStoreService()
    const service = new SettingsService(store)

    service.setDeveloperMode(true)

    expect(store.get("developerMode")).toBe(true)
  })
})
