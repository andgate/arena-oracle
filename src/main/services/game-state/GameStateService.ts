import { GameState, PendingDecision } from "@shared/game-state-types"
import type { TGameStateDiff, TGREMessage } from "@shared/gre-types"
import { parseLogLine } from "@shared/gre-types"
import { BehaviorSubject, Subject, Subscription } from "rxjs"
import { inject, injectable, singleton } from "tsyringe"
import { IStoppable } from "../lifecycle"
import { IPlayerLogService } from "../player-log/IPlayerLogService"
import { IGameStateService } from "./IGameStateService"
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

@injectable()
@singleton()
export class GameStateService implements IGameStateService, IStoppable {
  readonly stateUpdated$ = new BehaviorSubject<GameState>(initialGameState())
  readonly decisionRequired$ = new BehaviorSubject<GameState>(
    initialGameState(),
  )
  readonly gameReset$ = new Subject<void>()

  private gameState = initialGameState()
  private lineBuffer = ""
  // Deduplication — don't fire decisionRequired for the same
  // gameStateId + decision type more than once
  private lastDecisionKey = ""

  private unsubPlayerLog: Subscription | null = null

  constructor(@inject(IPlayerLogService) playerLogService: IPlayerLogService) {
    this.unsubPlayerLog = playerLogService.log$.subscribe((chunk) => {
      this.processChunk(chunk)
    })
  }

  stop() {
    this.unsubPlayerLog?.unsubscribe()
  }

  // ============================================================
  // Diff applicator
  // ============================================================

  private applyGameStateDiff(diff: TGameStateDiff) {
    // Detect new game: gameStateId reset to a low value while we have a high one
    const isNewGame =
      diff.gameStateId < this.gameState.gameStateId && diff.gameStateId <= 10
    if (isNewGame) {
      this.gameState = initialGameState()
      this.lastDecisionKey = ""
      this.gameReset$.next(undefined)
    }

    if (!isNewGame && diff.gameStateId <= this.gameState.gameStateId) return // already seen

    // Update game objects
    for (const obj of diff.gameObjects ?? []) {
      this.gameState.gameObjects[obj.instanceId] = obj
    }

    // Remove deleted objects
    for (const id of diff.diffDeletedInstanceIds ?? []) {
      delete this.gameState.gameObjects[id]
    }

    // Update zones
    for (const zone of diff.zones ?? []) {
      this.gameState.zones[zone.zoneId] = zone
    }

    // Update stack from the stack zone
    const stackZone = Object.values(this.gameState.zones).find(
      (z) => z.type === "ZoneType_Stack",
    )
    this.gameState.stack = stackZone?.objectInstanceIds ?? []

    // Update players
    for (const player of diff.players ?? []) {
      const seatId = player.systemSeatNumber ?? player.seatId
      if (seatId != null) {
        this.gameState.players[seatId] = {
          ...this.gameState.players[seatId],
          ...player,
        }
      }
    }

    // Update turn info
    if (diff.turnInfo) {
      this.gameState.turnInfo = diff.turnInfo
    }

    this.gameState.gameStateId = diff.gameStateId
  }

  // ============================================================
  // Decision emitter — deduplicates by gameStateId + type
  // ============================================================

  private emitDecision(decision: PendingDecision, gameStateId: number) {
    const key = `${gameStateId}:${decision.type}`
    if (key === this.lastDecisionKey) return
    this.lastDecisionKey = key

    this.gameState.pendingDecision = decision
    // Keep availableActions in sync for canCast checks in snapshot service
    if (decision.type === "ActionsAvailable") {
      this.gameState.availableActions = decision.actions
    } else {
      this.gameState.availableActions = []
    }

    this.decisionRequired$.next(structuredClone(this.gameState))
  }

  // ============================================================
  // Chunk processor — handles the raw string from the log watcher
  // ============================================================

  private processChunk(chunk: string) {
    // Chunks may split across lines, so we buffer
    this.lineBuffer += chunk
    const lines = this.lineBuffer.split("\n")

    // Keep the last (potentially incomplete) line in the buffer
    this.lineBuffer = lines.pop() ?? ""

    for (const line of lines) {
      const event = parseLogLine(line)
      if (!event) continue

      for (const msg of event.greToClientEvent
        .greToClientMessages as TGREMessage[]) {
        // Always try to grab localPlayerSeatId from any message
        if (
          this.gameState.localPlayerSeatId === null &&
          msg.systemSeatIds.length > 0
        ) {
          this.gameState.localPlayerSeatId = msg.systemSeatIds[0]
        }

        switch (msg.type) {
          case "GREMessageType_GameStateMessage": {
            this.applyGameStateDiff(msg.gameStateMessage)
            this.stateUpdated$.next(structuredClone(this.gameState))
            break
          }

          case "GREMessageType_ActionsAvailableReq": {
            this.emitDecision(
              {
                type: "ActionsAvailable",
                actions: msg.actionsAvailableReq.actions,
              },
              msg.gameStateId,
            )
            break
          }

          case "GREMessageType_DeclareAttackersReq": {
            this.emitDecision(
              {
                type: "DeclareAttackers",
                eligibleAttackers: msg.declareAttackersReq.qualifiedAttackers,
              },
              msg.gameStateId,
            )
            break
          }

          case "GREMessageType_DeclareBlockersReq": {
            this.emitDecision(
              {
                type: "DeclareBlockers",
                eligibleBlockers: msg.declareBlockersReq.blockers,
              },
              msg.gameStateId,
            )
            break
          }

          case "GREMessageType_SelectTargetsReq": {
            this.emitDecision(
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
            this.emitDecision(
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
            this.emitDecision(
              {
                type: "AssignDamage",
                damageAssigners: msg.assignDamageReq.damageAssigners,
              },
              msg.gameStateId,
            )
            break
          }

          case "GREMessageType_ConnectResp": {
            this.gameState = initialGameState()
            this.lastDecisionKey = ""
            this.gameReset$.next(undefined)
            break
          }

          case "GREMessageType_MulliganReq": {
            // Hand instance IDs are in the hand zone — grab them from current state
            const handZone = Object.values(this.gameState.zones).find(
              (z) =>
                z.type === "ZoneType_Hand" &&
                z.ownerSeatId === this.gameState.localPlayerSeatId,
            )
            this.emitDecision(
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
              this.emitDecision(
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
}
