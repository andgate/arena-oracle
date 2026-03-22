import { AbilityText, ResolvedCard } from "@shared/card-types"
import Database from "better-sqlite3"
import fs from "fs"
import path from "path"
import { injectable, singleton } from "tsyringe"
import { IStartable, IStoppable } from "../lifecycle"
import { ICardDbService } from "./CardDbService.interface"
import { findMtgaRawDataPath } from "./mtga-data-utils"

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

@injectable()
@singleton()
export class CardDbService implements ICardDbService, IStartable, IStoppable {
  // ============================================================
  // Service state
  // ============================================================

  private cardDb: Database.Database | null = null
  private cardCache: Map<number, ResolvedCard> = new Map()

  // ============================================================
  // Public API
  // ============================================================

  start() {
    const cardDbPath = findMtgaRawDataPath()
    if (!cardDbPath) {
      console.error("Could not find path for Raw_CardDatabase_*.mtga")
      return
    }

    const files = fs.readdirSync(cardDbPath)
    const dbFile = files.find(
      (f) => f.startsWith("Raw_CardDatabase_") && f.endsWith(".mtga"),
    )
    if (!dbFile) {
      console.error("Could not find Raw_CardDatabase_*.mtga in", cardDbPath)
      return
    }

    const dbPath = path.join(cardDbPath, dbFile)
    this.cardDb = new Database(dbPath, { readonly: true })
    this.cardCache = new Map()
  }

  stop(): void {
    this.cardDb?.close()
    this.cardDb = null
    this.cardCache = new Map()
  }

  lookupCard(grpId: number): ResolvedCard | undefined {
    if (!this.cardDb) return undefined
    if (this.cardCache.has(grpId)) return this.cardCache.get(grpId)

    const row = this.cardDb
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
      abilities: this.resolveAbilities(row.AbilityIds, this.cardDb!),
    }

    this.cardCache.set(grpId, resolved)
    return resolved
  }

  isLoaded(): boolean {
    return this.cardDb !== null
  }

  // ============================================================
  // Ability lookup
  // ============================================================

  private resolveAbilities(
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
}
