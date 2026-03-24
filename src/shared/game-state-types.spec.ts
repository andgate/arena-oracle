// src/shared/game-state-types.spec.ts

import { describe, expect, it } from "vitest"
import type { GameState } from "./game-state-types"
import {
  getBattlefieldInstanceIds,
  getExileInstanceIds,
  getGraveyardInstanceIds,
  getHandInstanceIds,
  getLibrarySize,
  getRevealedInstanceIds,
} from "./game-state-types"

// ============================================================
// Helpers
// ============================================================

function makeEmptyState(): GameState {
  return {
    gameObjects: {},
    zones: {},
    players: {},
    turnInfo: null,
    stack: [],
    availableActions: [],
    pendingDecision: null,
    localPlayerSeatId: null,
    gameStateId: 0,
  }
}

function withZone(
  state: GameState,
  zoneId: number,
  type: string,
  objectInstanceIds: number[],
  ownerSeatId?: number,
): GameState {
  return {
    ...state,
    zones: {
      ...state.zones,
      [zoneId]: {
        zoneId,
        type: type as any,
        visibility: "Visibility_Public",
        objectInstanceIds,
        ...(ownerSeatId !== undefined ? { ownerSeatId } : {}),
      },
    },
  }
}

function withGameObject(
  state: GameState,
  instanceId: number,
  controllerSeatId: number,
  ownerSeatId: number,
  zoneId: number,
): GameState {
  return {
    ...state,
    gameObjects: {
      ...state.gameObjects,
      [instanceId]: {
        instanceId,
        grpId: 1000 + instanceId,
        type: "GameObjectType_Card",
        zoneId,
        visibility: "Visibility_Public",
        ownerSeatId,
        controllerSeatId,
        cardTypes: [],
        subtypes: [],
        superTypes: [],
        color: [],
        abilities: [],
        name: 0,
        overlayGrpId: 0,
      },
    },
  }
}

// ============================================================
// getLibrarySize
// ============================================================

describe("getLibrarySize", () => {
  it("returns the correct count when the library zone exists", () => {
    const state = withZone(
      makeEmptyState(),
      1,
      "ZoneType_Library",
      [10, 11, 12],
      1,
    )
    expect(getLibrarySize(state, 1)).toBe(3)
  })

  it("returns 0 when the library zone is missing for the given owner", () => {
    const state = withZone(makeEmptyState(), 1, "ZoneType_Library", [10, 11], 2)
    expect(getLibrarySize(state, 1)).toBe(0)
  })

  it("returns 0 when the library zone exists but objectInstanceIds is empty", () => {
    const state = withZone(makeEmptyState(), 1, "ZoneType_Library", [], 1)
    expect(getLibrarySize(state, 1)).toBe(0)
  })
})

// ============================================================
// getHandInstanceIds
// ============================================================

describe("getHandInstanceIds", () => {
  it("returns instance IDs for the correct owner", () => {
    const state = withZone(
      makeEmptyState(),
      2,
      "ZoneType_Hand",
      [20, 21, 22],
      1,
    )
    expect(getHandInstanceIds(state, 1)).toEqual([20, 21, 22])
  })

  it("returns empty array when queried for the wrong owner", () => {
    const state = withZone(
      makeEmptyState(),
      2,
      "ZoneType_Hand",
      [20, 21, 22],
      1,
    )
    expect(getHandInstanceIds(state, 2)).toEqual([])
  })
})

// ============================================================
// getBattlefieldInstanceIds
// ============================================================

describe("getBattlefieldInstanceIds", () => {
  it("returns only instance IDs controlled by the given seat", () => {
    let state = makeEmptyState()
    state = withZone(state, 3, "ZoneType_Battlefield", [30, 31, 32], undefined)
    state = withGameObject(state, 30, 1, 1, 3) // controlled by seat 1
    state = withGameObject(state, 31, 1, 1, 3) // controlled by seat 1
    state = withGameObject(state, 32, 2, 2, 3) // controlled by seat 2

    expect(getBattlefieldInstanceIds(state, 1)).toEqual([30, 31])
    expect(getBattlefieldInstanceIds(state, 2)).toEqual([32])
  })

  it("returns empty array when there is no battlefield zone", () => {
    expect(getBattlefieldInstanceIds(makeEmptyState(), 1)).toEqual([])
  })

  it("returns empty array when no objects are controlled by the given seat", () => {
    let state = makeEmptyState()
    state = withZone(state, 3, "ZoneType_Battlefield", [30], undefined)
    state = withGameObject(state, 30, 2, 2, 3)

    expect(getBattlefieldInstanceIds(state, 1)).toEqual([])
  })

  it("returns empty array when the battlefield zone has no objectInstanceIds", () => {
    let state = makeEmptyState()
    state = withZone(state, 3, "ZoneType_Battlefield", [], undefined)
    // Manually remove objectInstanceIds to simulate an absent field from the GRE diff
    ;(state.zones[3] as any).objectInstanceIds = undefined

    expect(getBattlefieldInstanceIds(state, 1)).toEqual([])
  })
})

// ============================================================
// getGraveyardInstanceIds
// ============================================================

describe("getGraveyardInstanceIds", () => {
  it("returns instance IDs for the correct owner", () => {
    const state = withZone(
      makeEmptyState(),
      4,
      "ZoneType_Graveyard",
      [40, 41],
      1,
    )
    expect(getGraveyardInstanceIds(state, 1)).toEqual([40, 41])
  })

  it("returns empty array when there is no graveyard for the given owner", () => {
    const state = withZone(
      makeEmptyState(),
      4,
      "ZoneType_Graveyard",
      [40, 41],
      2,
    )
    expect(getGraveyardInstanceIds(state, 1)).toEqual([])
  })
})

// ============================================================
// getExileInstanceIds
// ============================================================

describe("getExileInstanceIds", () => {
  it("returns instance IDs when the exile zone has ownerSeatId set", () => {
    // NOTE: per the GRE log docs, ZoneType_Exile may not reliably carry
    // ownerSeatId. If the engine omits it, this accessor will always return [].
    // This test documents the current behavior — revisit if exile tracking
    // proves unreliable against live log data.
    const state = withZone(makeEmptyState(), 5, "ZoneType_Exile", [50, 51], 1)
    expect(getExileInstanceIds(state, 1)).toEqual([50, 51])
  })

  it("returns empty array when queried for the wrong owner", () => {
    const state = withZone(makeEmptyState(), 5, "ZoneType_Exile", [50, 51], 1)
    expect(getExileInstanceIds(state, 2)).toEqual([])
  })
})

// ============================================================
// getRevealedInstanceIds
// ============================================================

describe("getRevealedInstanceIds", () => {
  it("returns instance IDs for the correct owner", () => {
    const state = withZone(
      makeEmptyState(),
      6,
      "ZoneType_Revealed",
      [60, 61],
      1,
    )
    expect(getRevealedInstanceIds(state, 1)).toEqual([60, 61])
  })

  it("returns empty array when there is no revealed zone for the given owner", () => {
    const state = withZone(
      makeEmptyState(),
      6,
      "ZoneType_Revealed",
      [60, 61],
      2,
    )
    expect(getRevealedInstanceIds(state, 1)).toEqual([])
  })
})
