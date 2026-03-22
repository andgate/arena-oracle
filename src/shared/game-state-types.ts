import type {
  TAvailableAction,
  TDamageAssigner,
  TEligibleAttacker,
  TEligibleBlocker,
  TGameObject,
  TManaCost,
  TPlayerState,
  TTargetSlot,
  TTurnInfo,
  TZoneState,
} from "./gre-types"

// ============================================================
// Type Definitions
// ============================================================

export type PendingDecision =
  | {
      type: "ActionsAvailable"
      actions: TAvailableAction[]
    }
  | {
      type: "DeclareAttackers"
      eligibleAttackers: TEligibleAttacker[]
    }
  | {
      type: "DeclareBlockers"
      eligibleBlockers: TEligibleBlocker[]
    }
  | {
      type: "SelectTargets"
      sourceId: number | undefined
      abilityGrpId: number | undefined
      targetSlots: TTargetSlot[]
    }
  | {
      type: "PayCosts"
      manaCost: TManaCost[]
      paymentActions: TAvailableAction[]
    }
  | {
      type: "AssignDamage"
      damageAssigners: TDamageAssigner[]
    }
  | { type: "Mulligan"; mulliganCount: number; handInstanceIds: number[] }
  | { type: "LondonMulliganGroup"; instanceIds: number[]; keepCount: number }

export interface GameState {
  gameObjects: Record<number, TGameObject>
  zones: Record<number, TZoneState>
  players: Record<number, TPlayerState>
  turnInfo: TTurnInfo | null
  stack: number[]
  availableActions: TAvailableAction[] // keep for now, used by canCast check
  pendingDecision: PendingDecision | null
  localPlayerSeatId: number | null
  gameStateId: number
}

// ============================================================
// Accessors
//
// Important: battlefield/stack/graveyard/exile have no ownerSeatId
// in the log — ownership must be determined from the game object's
// controllerSeatId or ownerSeatId, not the zone itself.
// Only Hand and Library zones have ownerSeatId.
// ============================================================

export function getLibrarySize(state: GameState, ownerSeatId: number): number {
  const zone = Object.values(state.zones).find(
    (z) => z.type === "ZoneType_Library" && z.ownerSeatId === ownerSeatId,
  )
  return zone?.objectInstanceIds?.length ?? 0
}

export function getHandInstanceIds(
  state: GameState,
  ownerSeatId: number,
): number[] {
  const zone = Object.values(state.zones).find(
    (z) => z.type === "ZoneType_Hand" && z.ownerSeatId === ownerSeatId,
  )
  return zone?.objectInstanceIds ?? []
}

export function getBattlefieldInstanceIds(
  state: GameState,
  controllerSeatId: number,
): number[] {
  const zone = Object.values(state.zones).find(
    (z) => z.type === "ZoneType_Battlefield",
  )
  if (!zone) return []
  return (zone.objectInstanceIds ?? []).filter(
    (id) => state.gameObjects[id]?.controllerSeatId === controllerSeatId,
  )
}

export function getGraveyardInstanceIds(
  state: GameState,
  ownerSeatId: number,
): number[] {
  const zone = Object.values(state.zones).find(
    (z) => z.type === "ZoneType_Graveyard" && z.ownerSeatId === ownerSeatId,
  )
  return zone?.objectInstanceIds ?? []
}

export function getExileInstanceIds(
  state: GameState,
  ownerSeatId: number,
): number[] {
  const zone = Object.values(state.zones).find(
    (z) => z.type === "ZoneType_Exile" && z.ownerSeatId === ownerSeatId,
  )
  return zone?.objectInstanceIds ?? []
}

export function getRevealedInstanceIds(
  state: GameState,
  ownerSeatId: number,
): number[] {
  const zone = Object.values(state.zones).find(
    (z) => z.type === "ZoneType_Revealed" && z.ownerSeatId === ownerSeatId,
  )
  return zone?.objectInstanceIds ?? []
}
