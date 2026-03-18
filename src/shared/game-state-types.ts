import type {
  TAvailableAction,
  TGameObject,
  TPlayerState,
  TTurnInfo,
  TZoneState,
  TEligibleAttacker,
  TEligibleBlocker,
  TTargetSlot,
  TDamageAssigner,
  TManaCost, // need to export this from gre-types too — see note below
} from "./gre-types"

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
