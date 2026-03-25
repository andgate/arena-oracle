// src/shared/coaching-types.spec.ts

import { describe, expect, it } from "vitest"
import type { ResolvedCard } from "./card-types"
import {
  makeBattlefieldCard,
  makeHandCard,
  makeStackEntry,
} from "./coaching-types"
import type { GameState } from "./game-state-types"
import type { TGameObject } from "./gre-types"

// ============================================================
// Shared fixtures
// ============================================================

function makeResolvedCard(overrides: Partial<ResolvedCard> = {}): ResolvedCard {
  return {
    grpId: 1001,
    name: "Test Card",
    manaCost: "{2}{G}",
    typeLine: "Creature",
    subtypeLine: "Elf Druid",
    colors: ["Green"],
    power: "2",
    toughness: "3",
    rarity: "Common",
    set: "TST",
    abilities: [{ id: 1, text: "Tap: Add {G}." }],
    ...overrides,
  }
}

function makeGameObject(overrides: Partial<TGameObject> = {}): TGameObject {
  return {
    instanceId: 42,
    grpId: 1001,
    type: "GameObjectType_Card",
    zoneId: 10,
    visibility: "Visibility_Public",
    ownerSeatId: 1,
    controllerSeatId: 1,
    cardTypes: ["CardType_Creature"],
    subtypes: [],
    superTypes: [],
    color: ["CardColor_Green"],
    abilities: [],
    name: 9999,
    overlayGrpId: 0,
    ...overrides,
  }
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameObjects: {},
    zones: {},
    players: {},
    turnInfo: null,
    stack: [],
    availableActions: [],
    pendingDecision: null,
    localPlayerSeatId: 1,
    gameStateId: 5,
    ...overrides,
  }
}

// ============================================================
// makeBattlefieldCard
// ============================================================

describe("makeBattlefieldCard", () => {
  it("uses power/toughness from the game object when present", () => {
    const obj = makeGameObject({
      power: { value: 5 },
      toughness: { value: 4 },
    })
    const card = makeResolvedCard({ power: "2", toughness: "3" })
    const result = makeBattlefieldCard(42, obj, card)

    expect(result.power).toBe("5")
    expect(result.toughness).toBe("4")
  })

  it("falls back to card printed power/toughness when obj values are absent", () => {
    const obj = makeGameObject({ power: undefined, toughness: undefined })
    const card = makeResolvedCard({ power: "*", toughness: "1" })
    const result = makeBattlefieldCard(42, obj, card)

    expect(result.power).toBe("*")
    expect(result.toughness).toBe("1")
  })

  it("sets isTapped to true when obj.isTapped is true", () => {
    const obj = makeGameObject({ isTapped: true })
    const result = makeBattlefieldCard(42, obj, makeResolvedCard())
    expect(result.isTapped).toBe(true)
  })

  it("sets isTapped to false when obj.isTapped is false", () => {
    const obj = makeGameObject({ isTapped: false })
    const result = makeBattlefieldCard(42, obj, makeResolvedCard())
    expect(result.isTapped).toBe(false)
  })

  it("sets isTapped to false when obj.isTapped is absent", () => {
    const obj = makeGameObject({ isTapped: undefined })
    const result = makeBattlefieldCard(42, obj, makeResolvedCard())
    expect(result.isTapped).toBe(false)
  })

  it("sets hasSummoningSickness to true when obj.hasSummoningSickness is true", () => {
    const obj = makeGameObject({ hasSummoningSickness: true })
    const result = makeBattlefieldCard(42, obj, makeResolvedCard())
    expect(result.hasSummoningSickness).toBe(true)
  })

  it("sets hasSummoningSickness to false when obj.hasSummoningSickness is absent", () => {
    const obj = makeGameObject({ hasSummoningSickness: undefined })
    const result = makeBattlefieldCard(42, obj, makeResolvedCard())
    expect(result.hasSummoningSickness).toBe(false)
  })

  it("sets isAttacking to true when attackState is AttackState_Attacking", () => {
    const obj = makeGameObject({ attackState: "AttackState_Attacking" })
    const result = makeBattlefieldCard(42, obj, makeResolvedCard())
    expect(result.isAttacking).toBe(true)
  })

  it("sets isAttacking to false when attackState is absent", () => {
    const obj = makeGameObject({ attackState: undefined })
    const result = makeBattlefieldCard(42, obj, makeResolvedCard())
    expect(result.isAttacking).toBe(false)
  })

  it("sets isAttacking to false when attackState is some other value", () => {
    const obj = makeGameObject({ attackState: "AttackState_None" })
    const result = makeBattlefieldCard(42, obj, makeResolvedCard())
    expect(result.isAttacking).toBe(false)
  })

  it("maps abilities from card ability text", () => {
    const card = makeResolvedCard({
      abilities: [
        { id: 1, text: "Flying" },
        { id: 2, text: "Tap: Add {G}." },
      ],
    })
    const result = makeBattlefieldCard(42, makeGameObject(), card)
    expect(result.abilities).toEqual(["Flying", "Tap: Add {G}."])
  })

  it("sets instanceId from the provided argument", () => {
    const result = makeBattlefieldCard(99, makeGameObject(), makeResolvedCard())
    expect(result.instanceId).toBe(99)
  })
})

// ============================================================
// makeHandCard
// ============================================================

describe("makeHandCard", () => {
  it("sets canCast to true when the card has a Cast action in pendingDecision", () => {
    const state = makeGameState({
      pendingDecision: {
        type: "ActionsAvailable",
        actions: [{ actionType: "ActionType_Cast", instanceId: 42 }],
      },
    })
    const result = makeHandCard(42, makeResolvedCard(), state)
    expect(result.canCast).toBe(true)
  })

  it("sets canCast to false when the card does not appear as a Cast action", () => {
    const state = makeGameState({
      pendingDecision: {
        type: "ActionsAvailable",
        actions: [{ actionType: "ActionType_Cast", instanceId: 99 }],
      },
    })
    const result = makeHandCard(42, makeResolvedCard(), state)
    expect(result.canCast).toBe(false)
  })

  it("sets canCast to false when pendingDecision is null", () => {
    const state = makeGameState({ pendingDecision: null })
    const result = makeHandCard(42, makeResolvedCard(), state)
    expect(result.canCast).toBe(false)
  })

  it("sets canCast to false when pendingDecision is a non-ActionsAvailable type", () => {
    const state = makeGameState({
      pendingDecision: {
        type: "Mulligan",
        mulliganCount: 0,
        handInstanceIds: [],
      },
    })
    const result = makeHandCard(42, makeResolvedCard(), state)
    expect(result.canCast).toBe(false)
  })

  it("sets canPlay to true when the card has a Play action in pendingDecision", () => {
    const state = makeGameState({
      pendingDecision: {
        type: "ActionsAvailable",
        actions: [{ actionType: "ActionType_Play", instanceId: 42 }],
      },
    })
    const result = makeHandCard(42, makeResolvedCard(), state)
    expect(result.canPlay).toBe(true)
  })

  it("sets canPlay to false when the card does not appear as a Play action", () => {
    const state = makeGameState({
      pendingDecision: {
        type: "ActionsAvailable",
        actions: [{ actionType: "ActionType_Play", instanceId: 99 }],
      },
    })
    const result = makeHandCard(42, makeResolvedCard(), state)
    expect(result.canPlay).toBe(false)
  })

  it("sets canPlay to false when pendingDecision is null", () => {
    const state = makeGameState({ pendingDecision: null })
    const result = makeHandCard(42, makeResolvedCard(), state)
    expect(result.canPlay).toBe(false)
  })

  it("uses printed power and toughness from the card (not live values)", () => {
    const card = makeResolvedCard({ power: "3", toughness: "4" })
    const result = makeHandCard(42, card, makeGameState())
    expect(result.power).toBe("3")
    expect(result.toughness).toBe("4")
  })
})

// ============================================================
// makeStackEntry
// ============================================================

describe("makeStackEntry", () => {
  it("sets controlledByLocalPlayer to true when controllerSeatId matches localPlayerSeatId", () => {
    const obj = makeGameObject({ controllerSeatId: 1 })
    const state = makeGameState({ localPlayerSeatId: 1 })
    const result = makeStackEntry(42, obj, state, makeResolvedCard())
    expect(result.controlledByLocalPlayer).toBe(true)
  })

  it("sets controlledByLocalPlayer to false when controllerSeatId does not match localPlayerSeatId", () => {
    const obj = makeGameObject({ controllerSeatId: 2 })
    const state = makeGameState({ localPlayerSeatId: 1 })
    const result = makeStackEntry(42, obj, state, makeResolvedCard())
    expect(result.controlledByLocalPlayer).toBe(false)
  })

  it("sets controlledByLocalPlayer to false when localPlayerSeatId is null", () => {
    const obj = makeGameObject({ controllerSeatId: 1 })
    const state = makeGameState({ localPlayerSeatId: null })
    const result = makeStackEntry(42, obj, state, makeResolvedCard())
    expect(result.controlledByLocalPlayer).toBe(false)
  })

  it("sets instanceId from the provided argument", () => {
    const result = makeStackEntry(
      77,
      makeGameObject(),
      makeGameState(),
      makeResolvedCard(),
    )
    expect(result.instanceId).toBe(77)
  })

  it("includes name and manaCost from the resolved card", () => {
    const card = makeResolvedCard({ name: "Lightning Bolt", manaCost: "{R}" })
    const result = makeStackEntry(42, makeGameObject(), makeGameState(), card)
    expect(result.name).toBe("Lightning Bolt")
    expect(result.manaCost).toBe("{R}")
  })
})
