// ============================================================
// Resolved card shape
// ============================================================

export interface ResolvedCard {
  grpId: number
  name: string
  manaCost: string // e.g. "{1}{G}"
  typeLine: string // e.g. "Legendary Creature"
  subtypeLine: string // e.g. "Elf Druid"
  colors: string[] // still decoded from Colors column
  power: string
  toughness: string
  rarity: string
  set: string
  abilities: AbilityText[]
}

export interface AbilityText {
  id: number
  text: string // with CARDNAME and mana symbols decoded
}
