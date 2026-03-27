import { GameState, PendingDecision } from "@shared/game-state-types"
import type { TGameStateDiff, TGREMessage } from "@shared/gre-types"
import { produce } from "immer"

// ============================================================
// Effects — side effects to publish after reducing a message
// ============================================================

export type Effect =
  | { type: "stateUpdated"; state: GameState }
  | { type: "decisionRequired"; state: GameState }
  | { type: "gameReset" }

export type ReducerResult = {
  state: GameState
  lastDecisionKey: string
  effects: Effect[]
}

// ============================================================
// Diff applicator — Immer-based upsert/delete/merge/reset detection
// ============================================================

function applyDiff(
  state: GameState,
  diff: TGameStateDiff,
  lastDecisionKey: string,
): {
  state: GameState
  lastDecisionKey: string
  effects: Effect[]
} {
  const effects: Effect[] = []

  // Detect new game: gameStateId reset to a low value while we have a high one
  const isNewGame =
    diff.gameStateId < state.gameStateId && diff.gameStateId <= 10
  if (isNewGame) {
    effects.push({ type: "gameReset" })
    return {
      state: initialGameState(),
      lastDecisionKey: "",
      effects,
    }
  }

  if (!isNewGame && diff.gameStateId <= state.gameStateId) {
    // Already seen — no-op
    return { state, lastDecisionKey, effects }
  }

  const next = produce(state, (draft) => {
    // Update game objects
    for (const obj of diff.gameObjects ?? []) {
      draft.gameObjects[obj.instanceId] = obj
    }

    // Remove deleted objects
    for (const id of diff.diffDeletedInstanceIds ?? []) {
      delete draft.gameObjects[id]
    }

    // Update zones
    for (const zone of diff.zones ?? []) {
      draft.zones[zone.zoneId] = zone
    }

    // Update stack from the stack zone
    const stackZone = Object.values(draft.zones).find(
      (z) => z.type === "ZoneType_Stack",
    )
    draft.stack = stackZone?.objectInstanceIds ?? []

    // Update players
    for (const player of diff.players ?? []) {
      const seatId = player.systemSeatNumber ?? player.seatId
      if (seatId != null) {
        draft.players[seatId] = {
          ...draft.players[seatId],
          ...player,
        }
      }
    }

    // Update turn info
    if (diff.turnInfo) {
      draft.turnInfo = diff.turnInfo
    }

    draft.gameStateId = diff.gameStateId
  })

  return { state: next, lastDecisionKey, effects }
}

// ============================================================
// Decision builder — maps each GRE message type to its PendingDecision shape
// ============================================================

function buildDecision(
  msg: TGREMessage,
  state: GameState,
): PendingDecision | null {
  switch (msg.type) {
    case "GREMessageType_ActionsAvailableReq":
      return {
        type: "ActionsAvailable",
        actions: msg.actionsAvailableReq.actions,
      }

    case "GREMessageType_DeclareAttackersReq":
      return {
        type: "DeclareAttackers",
        eligibleAttackers: msg.declareAttackersReq.qualifiedAttackers,
      }

    case "GREMessageType_DeclareBlockersReq":
      return {
        type: "DeclareBlockers",
        eligibleBlockers: msg.declareBlockersReq.blockers,
      }

    case "GREMessageType_SelectTargetsReq":
      return {
        type: "SelectTargets",
        sourceId: msg.selectTargetsReq.sourceId,
        abilityGrpId: msg.selectTargetsReq.abilityGrpId,
        targetSlots: msg.selectTargetsReq.targets,
      }

    case "GREMessageType_PayCostsReq":
      return {
        type: "PayCosts",
        manaCost: msg.payCostsReq.manaCost ?? [],
        paymentActions: msg.payCostsReq.paymentActions?.actions ?? [],
      }

    case "GREMessageType_AssignDamageReq":
      return {
        type: "AssignDamage",
        damageAssigners: msg.assignDamageReq.damageAssigners,
      }

    case "GREMessageType_MulliganReq": {
      // Hand instance IDs are in the hand zone — grab them from current state
      const handZone = Object.values(state.zones).find(
        (z) =>
          z.type === "ZoneType_Hand" &&
          z.ownerSeatId === state.localPlayerSeatId,
      )
      return {
        type: "Mulligan",
        mulliganCount: msg.mulliganReq.mulliganCount ?? 0,
        handInstanceIds: handZone?.objectInstanceIds ?? [],
      }
    }

    case "GREMessageType_GroupReq": {
      if (msg.groupReq.context !== "GroupingContext_LondonMulligan") return null
      // keepCount is the lowerBound of the Hand groupSpec
      const handSpec = msg.groupReq.groupSpecs.find(
        (s) => s.zoneType === "ZoneType_Hand",
      )
      return {
        type: "LondonMulliganGroup",
        instanceIds: msg.groupReq.instanceIds,
        keepCount: handSpec?.lowerBound ?? msg.groupReq.instanceIds.length,
      }
    }

    default:
      return null
  }
}

// ============================================================
// initialGameState — kept here so the reducer is self-contained
// (GameStateService re-exports it for its own init)
// ============================================================

export const initialGameState = (): GameState => ({
  gameObjects: {},
  zones: {},
  players: {},
  turnInfo: null,
  stack: [],
  availableActions: [],
  pendingDecision: null,
  localPlayerSeatId: null,
  gameStateId: 0,
})

// ============================================================
// reduceMessage — pure function, no RxJS, no subjects, no side effects.
// Takes current state + lastDecisionKey + a parsed GRE message,
// returns next state, updated decision key, and effects to publish.
// ============================================================

export function reduceMessage(
  state: GameState,
  lastDecisionKey: string,
  msg: TGREMessage,
): ReducerResult {
  // ConnectResp signals a hard reset regardless of gameStateId
  if (msg.type === "GREMessageType_ConnectResp") {
    return {
      state: initialGameState(),
      lastDecisionKey: "",
      effects: [{ type: "gameReset" }],
    }
  }

  // Apply game state diff and emit stateUpdated
  if (msg.type === "GREMessageType_GameStateMessage") {
    const {
      state: next,
      lastDecisionKey: nextKey,
      effects,
    } = applyDiff(state, msg.gameStateMessage, lastDecisionKey)
    // Only emit stateUpdated if the diff was actually applied (not a no-op or reset)
    if (!effects.find((e) => e.type === "gameReset") && next !== state) {
      effects.push({ type: "stateUpdated", state: structuredClone(next) })
    }
    return { state: next, lastDecisionKey: nextKey, effects }
  }

  // Decision messages — deduplicates by gameStateId + decision type
  const decision = buildDecision(msg, state)
  if (decision) {
    const key = `${msg.gameStateId}:${decision.type}`
    if (key === lastDecisionKey) {
      // Already fired — no-op
      return { state, lastDecisionKey, effects: [] }
    }

    const next = produce(state, (draft) => {
      draft.pendingDecision = decision
      // Keep availableActions in sync for canCast checks in snapshot service
      if (decision.type === "ActionsAvailable") {
        draft.availableActions = decision.actions
      } else {
        draft.availableActions = []
      }
    })

    return {
      state: next,
      lastDecisionKey: key,
      effects: [{ type: "decisionRequired", state: structuredClone(next) }],
    }
  }

  // Unhandled message type — pass state through unchanged
  return { state, lastDecisionKey, effects: [] }
}
