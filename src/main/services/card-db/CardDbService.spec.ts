import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CardDbService } from "./CardDbService"

const FIXTURE_DB_PATH = path.resolve(__dirname, "__fixtures__", "test_card.db")

const { mockGetCardDbFile, mockDatabaseFactory } = vi.hoisted(() => ({
  mockGetCardDbFile: vi.fn<() => string | null>(),
  mockDatabaseFactory: {
    current: null as null | (() => {
      close: ReturnType<typeof vi.fn>
      prepare: ReturnType<typeof vi.fn>
    }),
  },
}))

vi.mock("@main/utils/mtga-paths", () => ({
  getCardDbFile: () => mockGetCardDbFile(),
}))

vi.mock("better-sqlite3", async () => {
  const actual =
    await vi.importActual<typeof import("better-sqlite3")>("better-sqlite3")

  return {
    default: vi.fn(function MockDatabase(...args: unknown[]) {
      if (mockDatabaseFactory.current) {
        return mockDatabaseFactory.current()
      }

      return Reflect.construct(actual, args)
    }),
  }
})

describe("CardDbService", () => {
  let service: CardDbService

  beforeEach(() => {
    mockGetCardDbFile.mockReturnValue(FIXTURE_DB_PATH)
    mockDatabaseFactory.current = null
    service = new CardDbService()
  })

  afterEach(() => {
    service.stop()
    vi.restoreAllMocks()
  })

  it("is not loaded before start and returns undefined for lookups", () => {
    expect(service.isLoaded()).toBe(false)
    expect(service.lookupCard(75570)).toBeUndefined()
  })

  it("loads the fixture DB on start", () => {
    service.start()

    expect(service.isLoaded()).toBe(true)
  })

  it("resolves a basic single-color creature card", () => {
    service.start()

    expect(service.lookupCard(75570)).toEqual({
      grpId: 75570,
      name: "Llanowar Elves",
      manaCost: "{G}",
      typeLine: "Creature",
      subtypeLine: "Elf Druid",
      colors: ["Green"],
      power: "1",
      toughness: "1",
      rarity: "Uncommon",
      set: "ANA",
      abilities: [
        {
          id: 1005,
          text: "{T}: Add {G}.",
        },
      ],
    })
  })

  it("maps colors correctly for multicolor and colorless cards", () => {
    service.start()

    expect(service.lookupCard(87848)?.colors).toEqual(["Red", "Green"])
    expect(service.lookupCard(79416)?.colors).toEqual([])
  })

  it("returns empty power and toughness when absent", () => {
    service.start()

    expect(service.lookupCard(80872)).toMatchObject({
      power: "",
      toughness: "",
    })
    expect(service.lookupCard(65363)).toMatchObject({
      power: "",
      toughness: "",
    })
  })

  it("resolves multiple decoded abilities", () => {
    service.start()

    expect(service.lookupCard(87848)?.abilities).toEqual([
      {
        id: 9,
        text: "Haste",
      },
      {
        id: 86,
        text: "Cascade",
      },
    ])
  })

  it("returns undefined for an unknown grpId", () => {
    service.start()

    expect(service.lookupCard(999999999)).toBeUndefined()
  })

  it("returns the cached object on repeated lookup", () => {
    service.start()

    const first = service.lookupCard(75570)
    const second = service.lookupCard(75570)

    expect(first).toBe(second)
  })

  it("closes the DB on stop and clears loaded state", () => {
    service.start()

    service.stop()

    expect(service.isLoaded()).toBe(false)
    expect(service.lookupCard(75570)).toBeUndefined()
  })
})

type MockCardRow = {
  AbilityIds: string
  Colors: string | null
  ExpansionCode: string | null
  GrpId: number
  Name: string
  OldSchoolManaText: string
  Power: string | null
  Rarity: number
  SubtypeLine: string | null
  Toughness: string | null
  TypeLine: string
}

describe("CardDbService edge cases", () => {
  afterEach(() => {
    mockGetCardDbFile.mockReturnValue(FIXTURE_DB_PATH)
    mockDatabaseFactory.current = null
    vi.restoreAllMocks()
  })

  it("logs and does not load when the card DB file cannot be resolved", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockGetCardDbFile.mockReturnValue(null)
    const service = new CardDbService()

    service.start()

    expect(service.isLoaded()).toBe(false)
    expect(errorSpy).toHaveBeenCalledWith(
      "Could not find path for Raw_CardDatabase_*.mtga",
    )
  })

  it("maps fallback values and ignores missing ability rows", () => {
    const cardRow: MockCardRow = {
      AbilityIds: "9:101,86:27",
      Colors: "7",
      ExpansionCode: null,
      GrpId: 42,
      Name: "Test Card",
      OldSchoolManaText: "",
      Power: null,
      Rarity: 99,
      SubtypeLine: null,
      Toughness: null,
      TypeLine: "Artifact",
    }
    const prepare = vi.fn((sql: string) => ({
      get: vi.fn((value: number) => {
        if (sql.includes("FROM Cards c")) return cardRow
        if (sql.includes("FROM Abilities a")) {
          return value === 9 ? { Id: 9, Loc: "" } : undefined
        }
        return undefined
      }),
    }))

    mockGetCardDbFile.mockReturnValue("C:\\fixtures\\test_card.db")
    mockDatabaseFactory.current = () => ({
      close: vi.fn(),
      prepare,
    })

    const service = new CardDbService()

    service.start()

    expect(service.lookupCard(42)).toEqual({
      abilities: [{ id: 9, text: "" }],
      colors: ["7"],
      grpId: 42,
      manaCost: "",
      name: "Test Card",
      power: "",
      rarity: "Unknown",
      set: "",
      subtypeLine: "",
      toughness: "",
      typeLine: "Artifact",
    })
  })
})
