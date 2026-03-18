import { parseLogLine } from "@shared/gre-types"
import type { TGameStateDiff, TGREMessage } from "@shared/gre-types"
import { GameState, PendingDecision } from "@shared/game-state-types"
import { gameStateEvents, playerLogEvents } from "../event-bus"

// ============================================================
// Game State
// ============================================================

const initialGameState = (): GameState => ({
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

let gameState: GameState = initialGameState()
let lineBuffer = ""
let unsubscribeChunk: (() => void) | null = null

// Deduplication — don't fire decisionRequired for the same
// gameStateId + decision type more than once
let lastDecisionKey = ""

// ============================================================
// Diff applicator
// ============================================================

function applyGameStateDiff(diff: TGameStateDiff) {
  // Detect new game: gameStateId reset to a low value while we have a high one
  const isNewGame =
    diff.gameStateId < gameState.gameStateId && diff.gameStateId <= 10
  if (isNewGame) {
    gameState = initialGameState()
    lastDecisionKey = ""
    gameStateEvents.emit("gameReset", undefined)
  }

  if (!isNewGame && diff.gameStateId <= gameState.gameStateId) return // already seen

  // Update game objects
  for (const obj of diff.gameObjects ?? []) {
    gameState.gameObjects[obj.instanceId] = obj
  }

  // Remove deleted objects
  for (const id of diff.diffDeletedInstanceIds ?? []) {
    delete gameState.gameObjects[id]
  }

  // Update zones
  for (const zone of diff.zones ?? []) {
    gameState.zones[zone.zoneId] = zone
  }

  // Update stack from the stack zone
  const stackZone = Object.values(gameState.zones).find(
    (z) => z.type === "ZoneType_Stack",
  )
  gameState.stack = stackZone?.objectInstanceIds ?? []

  // Update players
  for (const player of diff.players ?? []) {
    const seatId = player.systemSeatNumber ?? player.seatId
    if (seatId != null) {
      gameState.players[seatId] = { ...gameState.players[seatId], ...player }
    }
  }

  // Update turn info
  if (diff.turnInfo) {
    gameState.turnInfo = diff.turnInfo
  }

  gameState.gameStateId = diff.gameStateId
}

// ============================================================
// Decision emitter — deduplicates by gameStateId + type
// ============================================================

function emitDecision(decision: PendingDecision, gameStateId: number) {
  const key = `${gameStateId}:${decision.type}`
  if (key === lastDecisionKey) return
  lastDecisionKey = key

  gameState.pendingDecision = decision
  // Keep availableActions in sync for canCast checks in snapshot service
  if (decision.type === "ActionsAvailable") {
    gameState.availableActions = decision.actions
  } else {
    gameState.availableActions = []
  }

  gameStateEvents.emit("decisionRequired", gameState)
}

// ============================================================
// Chunk processor — handles the raw string from the log watcher
// ============================================================

function processChunk(chunk: string) {
  // Chunks may split across lines, so we buffer
  lineBuffer += chunk
  const lines = lineBuffer.split("\n")

  // Keep the last (potentially incomplete) line in the buffer
  lineBuffer = lines.pop() ?? ""

  for (const line of lines) {
    const event = parseLogLine(line)
    if (!event) continue

    for (const msg of event.greToClientEvent
      .greToClientMessages as TGREMessage[]) {
      // Always try to grab localPlayerSeatId from any message
      if (
        gameState.localPlayerSeatId === null &&
        msg.systemSeatIds.length > 0
      ) {
        gameState.localPlayerSeatId = msg.systemSeatIds[0]
      }

      switch (msg.type) {
        case "GREMessageType_GameStateMessage": {
          applyGameStateDiff(msg.gameStateMessage)
          gameStateEvents.emit("stateUpdated", gameState)
          break
        }

        case "GREMessageType_ActionsAvailableReq": {
          emitDecision(
            {
              type: "ActionsAvailable",
              actions: msg.actionsAvailableReq.actions,
            },
            msg.gameStateId,
          )
          break
        }

        case "GREMessageType_DeclareAttackersReq": {
          emitDecision(
            {
              type: "DeclareAttackers",
              eligibleAttackers: msg.declareAttackersReq.qualifiedAttackers,
            },
            msg.gameStateId,
          )
          break
        }

        case "GREMessageType_DeclareBlockersReq": {
          emitDecision(
            {
              type: "DeclareBlockers",
              eligibleBlockers: msg.declareBlockersReq.blockers,
            },
            msg.gameStateId,
          )
          break
        }

        case "GREMessageType_SelectTargetsReq": {
          emitDecision(
            {
              type: "SelectTargets",
              sourceId: msg.selectTargetsReq.sourceId,
              abilityGrpId: msg.selectTargetsReq.abilityGrpId,
              targetSlots: msg.selectTargetsReq.targets,
            },
            msg.gameStateId,
          )
          break
        }

        case "GREMessageType_PayCostsReq": {
          emitDecision(
            {
              type: "PayCosts",
              manaCost: msg.payCostsReq.manaCost ?? [],
              paymentActions: msg.payCostsReq.paymentActions?.actions ?? [],
            },
            msg.gameStateId,
          )
          break
        }

        case "GREMessageType_AssignDamageReq": {
          emitDecision(
            {
              type: "AssignDamage",
              damageAssigners: msg.assignDamageReq.damageAssigners,
            },
            msg.gameStateId,
          )
          break
        }

        case "GREMessageType_ConnectResp": {
          gameState = initialGameState()
          lastDecisionKey = ""
          gameStateEvents.emit("gameReset", undefined)
          break
        }

        case "GREMessageType_MulliganReq": {
          // Hand instance IDs are in the hand zone — grab them from current state
          const handZone = Object.values(gameState.zones).find(
            (z) =>
              z.type === "ZoneType_Hand" &&
              z.ownerSeatId === gameState.localPlayerSeatId,
          )
          emitDecision(
            {
              type: "Mulligan",
              mulliganCount: msg.mulliganReq.mulliganCount ?? 0,
              handInstanceIds: handZone?.objectInstanceIds ?? [],
            },
            msg.gameStateId,
          )
          break
        }

        case "GREMessageType_GroupReq": {
          if (msg.groupReq.context === "GroupingContext_LondonMulligan") {
            // keepCount is the lowerBound of the Hand groupSpec
            const handSpec = msg.groupReq.groupSpecs.find(
              (s) => s.zoneType === "ZoneType_Hand",
            )
            emitDecision(
              {
                type: "LondonMulliganGroup",
                instanceIds: msg.groupReq.instanceIds,
                keepCount:
                  handSpec?.lowerBound ?? msg.groupReq.instanceIds.length,
              },
              msg.gameStateId,
            )
          }
          break
        }
      }
    }
  }
}

// ============================================================
// Service lifecycle
// ============================================================

export function startGameStateService() {
  gameState = initialGameState()
  lineBuffer = ""
  lastDecisionKey = ""
  unsubscribeChunk = playerLogEvents.on("chunk", processChunk)
}

export function stopGameStateService() {
  unsubscribeChunk?.()
  unsubscribeChunk = null
}

export function getGameState(): GameState {
  return gameState
}
