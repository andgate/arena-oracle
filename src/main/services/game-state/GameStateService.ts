import { GameState, PendingDecision } from "@shared/game-state-types"
import type { TGameStateDiff, TGREMessage } from "@shared/gre-types"
import { parseLogLine } from "@shared/gre-types"
import { BehaviorSubject, Subject, Subscription } from "rxjs"
import { inject, injectable, singleton } from "tsyringe"
import { IStoppable } from "../lifecycle"
import { IPlayerLogService } from "../player-log/PlayerLogService.interface"
import { IGameStateService } from "./GameStateService.interface"

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
    this.unsubPlayerLog = null
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
  // Chunk processor — owns buffering, line-splitting, parseLogLine,
  // localPlayerSeatId init, and delegates each message to handleMessage
  // ============================================================

  private processChunk(chunk: string): void {
    this.lineBuffer += chunk
    const lines = this.lineBuffer.split("\n")
    this.lineBuffer = lines.pop() ?? ""

    for (const line of lines) {
      const event = parseLogLine(line)
      if (!event) continue

      for (const msg of event.greToClientEvent.greToClientMessages as TGREMessage[]) {
        // Always try to grab localPlayerSeatId from any message
        if (
          this.gameState.localPlayerSeatId === null &&
          msg.systemSeatIds.length > 0
        ) {
          this.gameState.localPlayerSeatId = msg.systemSeatIds[0]
        }
        this.handleMessage(msg)
      }
    }
  }

  // ============================================================
  // Message dispatcher — routes a single TGREMessage to its handler
  // ============================================================

  private handleMessage(msg: TGREMessage): void {
    switch (msg.type) {
      case "GREMessageType_GameStateMessage":    this.handleGameStateMessage(msg); break
      case "GREMessageType_ActionsAvailableReq": this.handleActionsAvailableReq(msg); break
      case "GREMessageType_DeclareAttackersReq": this.handleDeclareAttackersReq(msg); break
      case "GREMessageType_DeclareBlockersReq":  this.handleDeclareBlockersReq(msg); break
      case "GREMessageType_SelectTargetsReq":    this.handleSelectTargetsReq(msg); break
      case "GREMessageType_PayCostsReq":         this.handlePayCostsReq(msg); break
      case "GREMessageType_AssignDamageReq":     this.handleAssignDamageReq(msg); break
      case "GREMessageType_ConnectResp":         this.handleConnectResp(); break
      case "GREMessageType_MulliganReq":         this.handleMulliganReq(msg); break
      case "GREMessageType_GroupReq":            this.handleGroupReq(msg); break
    }
  }

  // ============================================================
  // Per-type handlers — one per GRE message type
  // ============================================================

  private handleGameStateMessage(
    msg: Extract<TGREMessage, { type: "GREMessageType_GameStateMessage" }>,
  ): void {
    this.applyGameStateDiff(msg.gameStateMessage)
    this.stateUpdated$.next(structuredClone(this.gameState))
  }

  private handleActionsAvailableReq(
    msg: Extract<TGREMessage, { type: "GREMessageType_ActionsAvailableReq" }>,
  ): void {
    this.emitDecision(
      {
        type: "ActionsAvailable",
        actions: msg.actionsAvailableReq.actions,
      },
      msg.gameStateId,
    )
  }

  private handleDeclareAttackersReq(
    msg: Extract<TGREMessage, { type: "GREMessageType_DeclareAttackersReq" }>,
  ): void {
    this.emitDecision(
      {
        type: "DeclareAttackers",
        eligibleAttackers: msg.declareAttackersReq.qualifiedAttackers,
      },
      msg.gameStateId,
    )
  }

  private handleDeclareBlockersReq(
    msg: Extract<TGREMessage, { type: "GREMessageType_DeclareBlockersReq" }>,
  ): void {
    this.emitDecision(
      {
        type: "DeclareBlockers",
        eligibleBlockers: msg.declareBlockersReq.blockers,
      },
      msg.gameStateId,
    )
  }

  private handleSelectTargetsReq(
    msg: Extract<TGREMessage, { type: "GREMessageType_SelectTargetsReq" }>,
  ): void {
    this.emitDecision(
      {
        type: "SelectTargets",
        sourceId: msg.selectTargetsReq.sourceId,
        abilityGrpId: msg.selectTargetsReq.abilityGrpId,
        targetSlots: msg.selectTargetsReq.targets,
      },
      msg.gameStateId,
    )
  }

  private handlePayCostsReq(
    msg: Extract<TGREMessage, { type: "GREMessageType_PayCostsReq" }>,
  ): void {
    this.emitDecision(
      {
        type: "PayCosts",
        manaCost: msg.payCostsReq.manaCost ?? [],
        paymentActions: msg.payCostsReq.paymentActions?.actions ?? [],
      },
      msg.gameStateId,
    )
  }

  private handleAssignDamageReq(
    msg: Extract<TGREMessage, { type: "GREMessageType_AssignDamageReq" }>,
  ): void {
    this.emitDecision(
      {
        type: "AssignDamage",
        damageAssigners: msg.assignDamageReq.damageAssigners,
      },
      msg.gameStateId,
    )
  }

  private handleConnectResp(
  ): void {
    this.gameState = initialGameState()
    this.lastDecisionKey = ""
    this.gameReset$.next(undefined)
  }

  private handleMulliganReq(
    msg: Extract<TGREMessage, { type: "GREMessageType_MulliganReq" }>,
  ): void {
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
  }

  private handleGroupReq(
    msg: Extract<TGREMessage, { type: "GREMessageType_GroupReq" }>,
  ): void {
    if (msg.groupReq.context === "GroupingContext_LondonMulligan") {
      // keepCount is the lowerBound of the Hand groupSpec
      const handSpec = msg.groupReq.groupSpecs.find(
        (s) => s.zoneType === "ZoneType_Hand",
      )
      this.emitDecision(
        {
          type: "LondonMulliganGroup",
          instanceIds: msg.groupReq.instanceIds,
          keepCount: handSpec?.lowerBound ?? msg.groupReq.instanceIds.length,
        },
        msg.gameStateId,
      )
    }
  }
}
