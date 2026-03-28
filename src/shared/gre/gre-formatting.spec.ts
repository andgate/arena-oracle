import { formatManaCost, getManaColorString } from "@shared/gre/gre-formatting"
import type { TAvailableAction, TManaCost } from "@shared/gre/gre-types"
import { describe, expect, test } from "vitest"

// ============================================================
// formatManaCost
// ============================================================

describe("formatManaCost", () => {
  test("formats a single generic cost", () => {
    expect(formatManaCost([{ color: ["ManaColor_Generic"], count: 2 }])).toBe(
      "{2}",
    )
  })

  test("formats a single colored pip", () => {
    expect(formatManaCost([{ color: ["ManaColor_Red"], count: 1 }])).toBe("{R}")
  })

  test("formats a generic + colored cost (e.g. {1}{R})", () => {
    expect(
      formatManaCost([
        { color: ["ManaColor_Generic"], count: 1 },
        { color: ["ManaColor_Red"], count: 1 },
      ]),
    ).toBe("{1}{R}")
  })

  test("repeats colored symbols for count > 1 (e.g. {W}{W})", () => {
    expect(formatManaCost([{ color: ["ManaColor_White"], count: 2 }])).toBe(
      "{W}{W}",
    )
  })

  test("formats a multi-color cost (e.g. {2}{G}{G})", () => {
    expect(
      formatManaCost([
        { color: ["ManaColor_Generic"], count: 2 },
        { color: ["ManaColor_Green"], count: 2 },
      ]),
    ).toBe("{2}{G}{G}")
  })

  test("formats all five colors", () => {
    expect(
      formatManaCost([
        { color: ["ManaColor_White"], count: 1 },
        { color: ["ManaColor_Blue"], count: 1 },
        { color: ["ManaColor_Black"], count: 1 },
        { color: ["ManaColor_Red"], count: 1 },
        { color: ["ManaColor_Green"], count: 1 },
      ]),
    ).toBe("{W}{U}{B}{R}{G}")
  })

  test("formats colorless mana ({C})", () => {
    expect(formatManaCost([{ color: ["ManaColor_Colorless"], count: 1 }])).toBe(
      "{C}",
    )
  })

  test("returns empty string for empty array", () => {
    expect(formatManaCost([])).toBe("")
  })

  test("falls back gracefully for unknown color keys", () => {
    // Cast needed to simulate an unrecognized color arriving at runtime
    const cost = [
      { color: ["ManaColor_Phyrexian"], count: 1 },
    ] as unknown as TManaCost[]
    expect(formatManaCost(cost)).toBe("{Phyrexian}")
  })
})

// ============================================================
// getManaColorString
// ============================================================

describe("getManaColorString", () => {
  test("returns '?' when manaSelections is absent", () => {
    const action: TAvailableAction = { actionType: "ActionType_Activate_Mana" }
    expect(getManaColorString(action)).toBe("?")
  })

  test("returns '?' when manaSelections[0].options is empty", () => {
    const action: TAvailableAction = {
      actionType: "ActionType_Activate_Mana",
      manaSelections: [{ instanceId: 1, abilityGrpId: 1, options: [] }],
    }
    expect(getManaColorString(action)).toBe("?")
  })

  test("returns a single color symbol for a mono-color land", () => {
    const action: TAvailableAction = {
      actionType: "ActionType_Activate_Mana",
      manaSelections: [
        {
          instanceId: 1,
          abilityGrpId: 1,
          options: [{ mana: [{ color: ["ManaColor_Green"], count: 1 }] }],
        },
      ],
    }
    expect(getManaColorString(action)).toBe("{G}")
  })

  test("returns ' or '-separated symbols for a dual-color land", () => {
    const action: TAvailableAction = {
      actionType: "ActionType_Activate_Mana",
      manaSelections: [
        {
          instanceId: 1,
          abilityGrpId: 1,
          options: [
            { mana: [{ color: ["ManaColor_Red"], count: 1 }] },
            { mana: [{ color: ["ManaColor_White"], count: 1 }] },
          ],
        },
      ],
    }
    expect(getManaColorString(action)).toBe("{R} or {W}")
  })

  test("handles three colors across options", () => {
    const action: TAvailableAction = {
      actionType: "ActionType_Activate_Mana",
      manaSelections: [
        {
          instanceId: 1,
          abilityGrpId: 1,
          options: [
            { mana: [{ color: ["ManaColor_White"], count: 1 }] },
            { mana: [{ color: ["ManaColor_Blue"], count: 1 }] },
            { mana: [{ color: ["ManaColor_Black"], count: 1 }] },
          ],
        },
      ],
    }
    expect(getManaColorString(action)).toBe("{W} or {U} or {B}")
  })
})
