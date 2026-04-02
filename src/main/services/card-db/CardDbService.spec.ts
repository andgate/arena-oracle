import Database from "better-sqlite3"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ISqlite3Service } from "../sqlite3/Sqlite3Service.interface"
import { CardDbService } from "./CardDbService"

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

const FIXTURE_DB_PATH = path.resolve(__dirname, "__fixtures__", "test_card.db")

const { mockGetCardDbFile } = vi.hoisted(() => ({
  mockGetCardDbFile: vi.fn<() => string | null>(),
}))

vi.mock("@main/utils/mtga-paths", () => ({
  getCardDbFile: () => mockGetCardDbFile(),
}))

class Sqlite3ServiceFake implements ISqlite3Service {
  constructor(
    private openImpl: (
      path: string,
      options?: Database.Options,
    ) => Database.Database,
  ) {}

  open(path: string, options?: Database.Options): Database.Database {
    return this.openImpl(path, options)
  }
}

function createMockDatabase({
  abilityRowsById = {},
  cardRow,
}: {
  abilityRowsById?: Record<number, { Id: number; Loc: string } | undefined>
  cardRow?: MockCardRow
}): Database.Database {
  return {
    close: vi.fn(),
    prepare: vi.fn((sql: string) => ({
      get: vi.fn((value: number) => {
        if (sql.includes("FROM Cards c")) return cardRow
        if (sql.includes("FROM Abilities a")) return abilityRowsById[value]
        return undefined
      }),
    })),
  } as unknown as Database.Database
}

describe("CardDbService", () => {
  let service: CardDbService

  beforeEach(() => {
    mockGetCardDbFile.mockReturnValue(FIXTURE_DB_PATH)
    service = new CardDbService(
      new Sqlite3ServiceFake(
        (dbPath, options) => new Database(dbPath, options),
      ),
    )
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

describe("CardDbService edge cases", () => {
  afterEach(() => {
    mockGetCardDbFile.mockReturnValue(FIXTURE_DB_PATH)
    vi.restoreAllMocks()
  })

  it("logs and does not load when the card DB file cannot be resolved", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockGetCardDbFile.mockReturnValue(null)
    const sqlite3Service = new Sqlite3ServiceFake(() => {
      throw new Error("should not open database when path is missing")
    })
    const service = new CardDbService(sqlite3Service)

    service.start()

    expect(service.isLoaded()).toBe(false)
    expect(errorSpy).toHaveBeenCalledWith(
      "Could not find path for Raw_CardDatabase_*.mtga",
    )
  })
})

describe("CardDbService mapping fallbacks", () => {
  let abilityRowsById: Record<number, { Id: number; Loc: string } | undefined>
  let cardRow: MockCardRow
  let service: CardDbService

  beforeEach(() => {
    cardRow = {
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
    abilityRowsById = {}

    const db = createMockDatabase({
      cardRow,
      abilityRowsById,
    })

    mockGetCardDbFile.mockReturnValue("C:\\fixtures\\test_card.db")
    const sqlite3Service = new Sqlite3ServiceFake(() => db)

    service = new CardDbService(sqlite3Service)
  })

  afterEach(() => {
    mockGetCardDbFile.mockReturnValue(FIXTURE_DB_PATH)
    service.stop()
    vi.restoreAllMocks()
  })

  it("maps fallback values for missing card fields", () => {
    cardRow.AbilityIds = ""

    service.start()

    expect(service.lookupCard(42)).toEqual({
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
      abilities: [],
    })
  })

  it("ignores missing ability rows", () => {
    abilityRowsById[9] = { Id: 9, Loc: "" }

    service.start()

    expect(service.lookupCard(42)?.abilities).toEqual([
      { id: 9, text: "" },
    ])
    expect(service.lookupCard(42)).toMatchObject({
      grpId: 42,
      name: "Test Card",
    })
  })
})
