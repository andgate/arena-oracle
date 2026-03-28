import { TAvailableAction } from "./gre-types"

const MANA_COLOR_SYMBOL: Record<string, string> = {
  ManaColor_White: "W",
  ManaColor_Blue: "U",
  ManaColor_Black: "B",
  ManaColor_Red: "R",
  ManaColor_Green: "G",
  ManaColor_Colorless: "C",
}

export function formatManaCost(
  manaCost: { color: string[]; count: number }[],
): string {
  return manaCost
    .map((m) => {
      const colorKey = m.color[0]
      if (colorKey === "ManaColor_Generic") return `{${m.count}}`
      const symbol =
        MANA_COLOR_SYMBOL[colorKey] ?? colorKey.replace("ManaColor_", "")
      // Repeat the symbol for count > 1 (e.g. {W}{W} not {2W})
      return Array(m.count).fill(`{${symbol}}`).join("")
    })
    .join("")
}

export function getManaColorString(action: TAvailableAction): string {
  const options = action.manaSelections?.[0]?.options ?? []
  if (options.length === 0) return "?"
  return options
    .map((opt) => {
      const color = String(opt.mana[0]?.color ?? "")
      const symbol = MANA_COLOR_SYMBOL[color] ?? color.replace("ManaColor_", "")
      return `{${symbol}}`
    })
    .join(" or ")
}
