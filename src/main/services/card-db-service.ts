import Database from "better-sqlite3"
import path from "path"
import fs from "fs"
import { AbilityText, ResolvedCard } from "@shared/card-types"

// ============================================================
// Hardcoded enum mappings (Enums table LocId join doesn't work)
// ============================================================

const COLOR_MAP: Record<string, string> = {
  "1": "White",
  "2": "Blue",
  "3": "Black",
  "4": "Red",
  "5": "Green",
}

const RARITY_MAP: Record<number, string> = {
  1: "Common",
  2: "Uncommon",
  3: "Rare",
  4: "Mythic Rare",
}

// ============================================================
// Mana cost decoder
// o1oGoG -> {1}{G}{G}
// oW     -> {W}
// oX     -> {X}
// oT     -> {T} (tap symbol, appears in ability text)
// ============================================================

function decodeManaText(raw: string): string {
  if (!raw) return ""
  // Split on 'o' and filter empty strings, then wrap each in {}
  return raw
    .split("o")
    .filter(Boolean)
    .map((s) => `{${s.toUpperCase()}}`)
    .join("")
}

// ============================================================
// Service state
// ============================================================

let cardDb: Database.Database | null = null
let cardCache: Map<number, ResolvedCard> = new Map()

// ============================================================
// Ability lookup
// ============================================================

function resolveAbilities(
  abilityIds: string,
  db: Database.Database,
): AbilityText[] {
  if (!abilityIds) return []
  return abilityIds
    .split(",")
    .map((id) => {
      const numId = parseInt(id.trim())
      const row = db
        .prepare(
          `
          SELECT a.Id, l.Loc 
          FROM Abilities a
          JOIN Localizations_enUS l ON a.TextId = l.LocId
          WHERE a.Id = ?
          LIMIT 1
        `,
        )
        .get(numId) as { Id: number; Loc: string } | undefined

      if (!row) return null

      // Decode mana symbols in ability text
      const text = row.Loc.split("o").reduce((acc, part, i) => {
        if (i === 0) return part
        // First char(s) up to a lowercase letter are the mana symbol
        const match = part.match(/^([0-9WUBRGCTXSQEP]+)(.*)$/i)
        if (match) return acc + `{${match[1].toUpperCase()}}` + match[2]
        return acc + part
      }, "")

      return { id: row.Id, text }
    })
    .filter((a): a is AbilityText => a !== null)
}

// ============================================================
// Public API
// ============================================================

export function loadCardDb(mtgaRawDataPath: string): void {
  const files = fs.readdirSync(mtgaRawDataPath)
  const dbFile = files.find(
    (f) => f.startsWith("Raw_CardDatabase_") && f.endsWith(".mtga"),
  )
  if (!dbFile) {
    console.error("Could not find Raw_CardDatabase_*.mtga in", mtgaRawDataPath)
    return
  }

  const dbPath = path.join(mtgaRawDataPath, dbFile)
  cardDb = new Database(dbPath, { readonly: true })
  cardCache = new Map()
}

export function lookupCard(grpId: number): ResolvedCard | undefined {
  if (!cardDb) return undefined
  if (cardCache.has(grpId)) return cardCache.get(grpId)

  const row = cardDb
    .prepare(
      `
      SELECT 
        c.GrpId,
        c.OldSchoolManaText,
        c.Colors,
        c.Power,
        c.Toughness,
        c.Rarity,
        c.ExpansionCode,
        c.IsPrimaryCard,
        c.AbilityIds,
        name.Loc     as Name,
        typeLine.Loc as TypeLine,
        subtype.Loc  as SubtypeLine
      FROM Cards c
      JOIN Localizations_enUS name    ON c.TitleId       = name.LocId
      JOIN Localizations_enUS typeLine ON c.TypeTextId   = typeLine.LocId
      LEFT JOIN Localizations_enUS subtype ON c.SubtypeTextId = subtype.LocId
      WHERE c.GrpId = ?
      LIMIT 1
    `,
    )
    .get(grpId) as any | undefined

  if (!row) return undefined

  const resolved: ResolvedCard = {
    grpId: row.GrpId,
    name: row.Name,
    manaCost: decodeManaText(row.OldSchoolManaText),
    typeLine: row.TypeLine,
    subtypeLine: row.SubtypeLine ?? "",
    colors: row.Colors
      ? row.Colors.split(",")
          .map((c: string) => COLOR_MAP[c.trim()] ?? c)
          .filter(Boolean)
      : [],
    power: row.Power,
    toughness: row.Toughness,
    rarity: RARITY_MAP[row.Rarity] ?? "Unknown",
    set: row.ExpansionCode ?? "",
    abilities: resolveAbilities(row.AbilityIds, cardDb!),
  }

  cardCache.set(grpId, resolved)
  return resolved
}

export function isCardDbLoaded(): boolean {
  return cardDb !== null
}

export function closeCardDb(): void {
  cardDb?.close()
  cardDb = null
  cardCache = new Map()
}
