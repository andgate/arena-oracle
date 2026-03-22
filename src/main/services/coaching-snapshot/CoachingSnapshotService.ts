import {
  BattlefieldCard,
  CoachingSnapshot,
  Decision,
  HandCard,
  makeBattlefieldCard,
  makeHandCard,
  makeStackEntry,
  StackEntry,
} from "@shared/coaching-types"
import {
  GameState,
  getBattlefieldInstanceIds,
  getExileInstanceIds,
  getGraveyardInstanceIds,
  getHandInstanceIds,
  getLibrarySize,
  getRevealedInstanceIds,
  PendingDecision,
} from "@shared/game-state-types"
import { TAvailableAction } from "@shared/gre-types"
import { BehaviorSubject, Subscription } from "rxjs"
import { inject, injectable, singleton } from "tsyringe"
import { ICardDbService } from "../card-db/ICardDbService"
import { IGameStateService } from "../game-state/IGameStateService"
import { IStoppable } from "../lifecycle"
import { ICoachingSnapshotService } from "./ICoachingSnapshotService"

// ============================================================
// Coaching Snapshot State
// ============================================================

// ============================================================
// Mana cost formatter
// ============================================================

const MANA_COLOR_SYMBOL: Record<string, string> = {
  ManaColor_White: "W",
  ManaColor_Blue: "U",
  ManaColor_Black: "B",
  ManaColor_Red: "R",
  ManaColor_Green: "G",
  ManaColor_Colorless: "C",
}

function formatManaCost(
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

// ============================================================
// Mana action collapsing
// ============================================================

function getManaColorString(action: TAvailableAction): string {
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

@injectable()
@singleton()
export class CoachingSnapshotService
  implements ICoachingSnapshotService, IStoppable
{
  readonly snapshot$ = new BehaviorSubject<CoachingSnapshot | null>(null)

  private unsubscribeDecision: Subscription | null = null
  private unsubscribeGameReset: Subscription | null = null

  constructor(
    @inject(IGameStateService) gameStateService: IGameStateService,
    @inject(ICardDbService) private cardDbService: ICardDbService,
  ) {
    this.unsubscribeGameReset = gameStateService.gameReset$.subscribe(() => {
      this.snapshot$.next(null)
    })

    // Only build snapshots when the player has decisions to make
    this.unsubscribeDecision = gameStateService.decisionRequired$.subscribe(
      (state: GameState) => this.snapshot$.next(this.buildSnapshot(state)),
    )
  }

  stop() {
    this.unsubscribeDecision?.unsubscribe()
    this.unsubscribeDecision = null
    this.unsubscribeGameReset?.unsubscribe()
    this.unsubscribeGameReset = null
  }

  // ============================================================
  // Card resolvers
  // ============================================================

  private resolveBattlefieldCard(
    instanceId: number,
    state: GameState,
  ): BattlefieldCard | null {
    const obj = state.gameObjects[instanceId]
    if (!obj) return null

    const card = this.cardDbService.lookupCard(obj.grpId)
    if (!card) return null

    return makeBattlefieldCard(instanceId, obj, card)
  }

  private resolveHandCard(
    instanceId: number,
    state: GameState,
  ): HandCard | null {
    const obj = state.gameObjects[instanceId]
    if (!obj) return null

    const card = this.cardDbService.lookupCard(obj.grpId)
    if (!card) return null

    return makeHandCard(instanceId, card, state)
  }

  private resolveStackEntry(
    instanceId: number,
    state: GameState,
  ): StackEntry | null {
    const obj = state.gameObjects[instanceId]
    if (!obj) return null

    // For abilities, objectSourceGrpId is the source card
    const lookupGrpId = obj.objectSourceGrpId ?? obj.grpId
    const card = this.cardDbService.lookupCard(lookupGrpId)
    if (!card) return null

    return makeStackEntry(instanceId, obj, state, card)
  }

  private collapseManaActions(actions: TAvailableAction[]): string[] {
    const grouped = new Map<
      number,
      { count: number; name: string; colorString: string }
    >()

    for (const a of actions) {
      const grpId = a.grpId ?? -1
      if (grouped.has(grpId)) {
        grouped.get(grpId)!.count++
        continue
      }
      const card = this.cardDbService.lookupCard(grpId)
      grouped.set(grpId, {
        count: 1,
        name: card?.name ?? `Unknown (grpId ${grpId})`,
        colorString: getManaColorString(a),
      })
    }

    return Array.from(grouped.values()).map(({ count, name, colorString }) =>
      count > 1
        ? `Tap ${name} for mana (${count} available) → ${colorString}`
        : `Tap ${name} for mana → ${colorString}`,
    )
  }

  // ============================================================
  // Decision builder
  // ============================================================

  private buildDecision(pending: PendingDecision, state: GameState): Decision {
    switch (pending.type) {
      case "ActionsAvailable": {
        const manaActions = pending.actions.filter(
          (a) => a.actionType === "ActionType_Activate_Mana",
        )
        const otherActions = pending.actions.filter(
          (a) =>
            a.actionType !== "ActionType_Activate_Mana" &&
            a.actionType !== "ActionType_FloatMana",
        )

        const otherStrings = otherActions.map((a) => {
          const obj = state.gameObjects[a.instanceId ?? -1]
          const card = obj ? this.cardDbService.lookupCard(obj.grpId) : null
          const cardName = card?.name ?? `Unknown (instance ${a.instanceId})`

          switch (a.actionType) {
            case "ActionType_Cast":
              return `Cast ${cardName} ${formatManaCost(a.manaCost ?? [])}`
            case "ActionType_Play":
              return `Play land: ${cardName}`
            case "ActionType_Activate":
              return `Activate ability: ${cardName}`
            case "ActionType_Pass":
              return "Pass priority"
            default:
              return a.actionType
          }
        })

        return {
          type: "ActionsAvailable",
          actions: [...otherStrings, ...this.collapseManaActions(manaActions)],
        }
      }

      case "DeclareAttackers": {
        const attackers = pending.eligibleAttackers.map((a) => {
          const obj = state.gameObjects[a.attackerInstanceId]
          const card = obj ? this.cardDbService.lookupCard(obj.grpId) : null
          return {
            instanceId: a.attackerInstanceId,
            name: card?.name ?? `Unknown (instance ${a.attackerInstanceId})`,
            power: obj?.power?.value?.toString() ?? card?.power ?? "?",
            toughness:
              obj?.toughness?.value?.toString() ?? card?.toughness ?? "?",
            isTapped: obj?.isTapped ?? false,
          }
        })
        return { type: "DeclareAttackers", eligibleAttackers: attackers }
      }

      case "DeclareBlockers": {
        const blockers = pending.eligibleBlockers.map((b) => {
          const obj = state.gameObjects[b.blockerInstanceId]
          const card = obj ? this.cardDbService.lookupCard(obj.grpId) : null
          const attackers = b.attackerInstanceIds.map((id) => {
            const aObj = state.gameObjects[id]
            const aCard = aObj
              ? this.cardDbService.lookupCard(aObj.grpId)
              : null
            return {
              instanceId: id,
              name: aCard?.name ?? `Unknown (instance ${id})`,
              power: aObj?.power?.value?.toString() ?? aCard?.power ?? "?",
              toughness:
                aObj?.toughness?.value?.toString() ?? aCard?.toughness ?? "?",
            }
          })
          return {
            instanceId: b.blockerInstanceId,
            name: card?.name ?? `Unknown (instance ${b.blockerInstanceId})`,
            power: obj?.power?.value?.toString() ?? card?.power ?? "?",
            toughness:
              obj?.toughness?.value?.toString() ?? card?.toughness ?? "?",
            attackers,
          }
        })
        return { type: "DeclareBlockers", eligibleBlockers: blockers }
      }

      case "SelectTargets": {
        const sourceObj = state.gameObjects[pending.sourceId ?? -1]
        const sourceCard = sourceObj
          ? this.cardDbService.lookupCard(sourceObj.grpId)
          : null
        const slots = pending.targetSlots.map((slot) => ({
          targetIdx: slot.targetIdx,
          minTargets: slot.minTargets ?? 1,
          maxTargets: slot.maxTargets ?? 1,
          options: (slot.targets ?? []).map((t) => {
            const tObj = state.gameObjects[t.targetInstanceId ?? -1]
            const tCard = tObj
              ? this.cardDbService.lookupCard(tObj.grpId)
              : null
            return {
              instanceId: t.targetInstanceId ?? -1,
              name: tCard?.name ?? `Unknown (instance ${t.targetInstanceId})`,
            }
          }),
        }))
        return {
          type: "SelectTargets",
          sourceName: sourceCard?.name ?? `Unknown (grpId ${pending.sourceId})`,
          targetSlots: slots,
        }
      }

      case "PayCosts": {
        const cost = formatManaCost(pending.manaCost)
        const options = pending.paymentActions.map((a) => {
          const obj = state.gameObjects[a.instanceId ?? -1]
          const card = obj ? this.cardDbService.lookupCard(obj.grpId) : null
          return card?.name ?? `Unknown (instance ${a.instanceId})`
        })
        return { type: "PayCosts", cost, paymentOptions: options }
      }

      case "AssignDamage": {
        const assigners = pending.damageAssigners.map((d) => {
          const obj = state.gameObjects[d.instanceId]
          const card = obj ? this.cardDbService.lookupCard(obj.grpId) : null
          const assignments = d.assignments.map((a) => {
            // instanceId 1 or 2 = player seat, otherwise a creature
            const isPlayer = a.instanceId <= 2
            const aObj = isPlayer ? null : state.gameObjects[a.instanceId]
            const aCard = aObj
              ? this.cardDbService.lookupCard(aObj.grpId)
              : null
            return {
              targetName: isPlayer
                ? a.instanceId === state.localPlayerSeatId
                  ? "You"
                  : "Opponent"
                : (aCard?.name ?? `Unknown (instance ${a.instanceId})`),
              minDamage: a.minDamage ?? 0,
              maxDamage: a.maxDamage ?? a.assignedDamage,
              assignedDamage: a.assignedDamage,
            }
          })
          return {
            attackerName: card?.name ?? `Unknown (instance ${d.instanceId})`,
            totalDamage: d.totalDamage,
            assignments,
          }
        })
        return { type: "AssignDamage", damageAssigners: assigners }
      }

      case "Mulligan": {
        const cards = pending.handInstanceIds.map((id) => {
          const obj = state.gameObjects[id]
          const card = obj ? this.cardDbService.lookupCard(obj.grpId) : null
          return card?.name ?? `Unknown (instance ${id})`
        })
        return { type: "Mulligan", mulliganCount: pending.mulliganCount, cards }
      }

      case "LondonMulliganGroup": {
        const cards = pending.instanceIds.map((id) => {
          const obj = state.gameObjects[id]
          const card = obj ? this.cardDbService.lookupCard(obj.grpId) : null
          return card?.name ?? `Unknown (instance ${id})`
        })
        return {
          type: "LondonMulliganGroup",
          cards,
          keepCount: pending.keepCount,
        }
      }
    }
  }

  // ============================================================
  // Snapshot builder
  // ============================================================

  private buildSnapshot(state: GameState): CoachingSnapshot | null {
    const isMulligan =
      state.pendingDecision?.type === "Mulligan" ||
      state.pendingDecision?.type === "LondonMulliganGroup"
    if (!state.turnInfo && !isMulligan) return null
    if (!state.localPlayerSeatId) return null
    if (!state.pendingDecision) return null

    const localSeatId = state.localPlayerSeatId
    const opponentSeatId = Object.values(state.players)
      .map((p) => p.systemSeatNumber ?? p.seatId)
      .find((id): id is number => id !== undefined && id !== localSeatId)

    if (opponentSeatId === undefined) return null

    const localPlayer = state.players[localSeatId]
    const opponent = state.players[opponentSeatId]

    // ---- Battlefield ----
    const localBattlefield = getBattlefieldInstanceIds(state, localSeatId)
      .map((id) => this.resolveBattlefieldCard(id, state))
      .filter((c): c is BattlefieldCard => c !== null)

    const opponentBattlefield = getBattlefieldInstanceIds(state, opponentSeatId)
      .map((id) => this.resolveBattlefieldCard(id, state))
      .filter((c): c is BattlefieldCard => c !== null)

    // ---- Hand ----
    const localHand = getHandInstanceIds(state, localSeatId)
      .map((id) => this.resolveHandCard(id, state))
      .filter((c): c is HandCard => c !== null)

    const localRevealed = getRevealedInstanceIds(state, localSeatId)
      .map((id) => this.resolveBattlefieldCard(id, state))
      .filter((c): c is BattlefieldCard => c !== null)

    const opponentHandSize = getHandInstanceIds(state, opponentSeatId).length
    const opponentRevealed = getRevealedInstanceIds(state, opponentSeatId)
      .map((id) => this.resolveBattlefieldCard(id, state))
      .filter((c): c is BattlefieldCard => c !== null)

    // ---- Graveyard / Exile ----
    const localGraveyard = getGraveyardInstanceIds(state, localSeatId)
      .map((id) => this.resolveBattlefieldCard(id, state))
      .filter((c): c is BattlefieldCard => c !== null)

    const localExile = getExileInstanceIds(state, localSeatId)
      .map((id) => this.resolveBattlefieldCard(id, state))
      .filter((c): c is BattlefieldCard => c !== null)

    const opponentGraveyard = getGraveyardInstanceIds(state, opponentSeatId)
      .map((id) => this.resolveBattlefieldCard(id, state))
      .filter((c): c is BattlefieldCard => c !== null)

    const opponentExile = getExileInstanceIds(state, opponentSeatId)
      .map((id) => this.resolveBattlefieldCard(id, state))
      .filter((c): c is BattlefieldCard => c !== null)

    // ---- Stack ----
    const stack = (state.stack ?? [])
      .map((id) => this.resolveStackEntry(id, state))
      .filter((e): e is StackEntry => e !== null)

    // ---- Decision ----
    const decision = this.buildDecision(state.pendingDecision, state)

    return {
      turnNumber: state.turnInfo?.turnNumber ?? 0,
      phase: state.turnInfo?.phase ?? "Phase_Beginning",
      step: state.turnInfo?.step ?? null,
      isLocalPlayerTurn: state.turnInfo?.activePlayer === localSeatId,
      localPlayer: {
        lifeTotal: localPlayer?.lifeTotal ?? 20,
        isLocalPlayer: true,
        battlefield: localBattlefield,
        hand: localHand,
        handSize: localHand.length,
        revealed: localRevealed,
        librarySize: getLibrarySize(state, localSeatId),
        graveyard: localGraveyard,
        graveyardSize: localGraveyard.length,
        exile: localExile,
        exileSize: localExile.length,
      },
      opponent: {
        lifeTotal: opponent?.lifeTotal ?? 20,
        isLocalPlayer: false,
        battlefield: opponentBattlefield,
        hand: [],
        handSize: opponentHandSize,
        revealed: opponentRevealed,
        librarySize: getLibrarySize(state, opponentSeatId),
        graveyard: opponentGraveyard,
        graveyardSize: opponentGraveyard.length,
        exile: opponentExile,
        exileSize: opponentExile.length,
      },
      stack,
      decision,
    }
  }
}
