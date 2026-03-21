import {
  BattlefieldCard,
  CoachingSnapshot,
  Decision,
  HandCard,
  StackEntry,
} from "@shared/coaching-types"
import { GameState, PendingDecision } from "@shared/game-state-types"
import { TAvailableAction } from "@shared/gre-types"
import { coachingEvents, gameStateEvents } from "../../event-bus"
import { lookupCard } from "../card-db/CardDbService"

// ============================================================
// Coaching Snapshot State
// ============================================================

let latestSnapshot: CoachingSnapshot | null = null

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

function collapseManaActions(actions: TAvailableAction[]): string[] {
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
    const card = lookupCard(grpId)
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
// Zone helpers
//
// Important: battlefield/stack/graveyard/exile have no ownerSeatId
// in the log — ownership must be determined from the game object's
// controllerSeatId or ownerSeatId, not the zone itself.
// Only Hand and Library zones have ownerSeatId.
// ============================================================

function getHandInstanceIds(state: GameState, ownerSeatId: number): number[] {
  const zone = Object.values(state.zones).find(
    (z) => z.type === "ZoneType_Hand" && z.ownerSeatId === ownerSeatId,
  )
  return zone?.objectInstanceIds ?? []
}

function getLibrarySize(state: GameState, ownerSeatId: number): number {
  const zone = Object.values(state.zones).find(
    (z) => z.type === "ZoneType_Library" && z.ownerSeatId === ownerSeatId,
  )
  return zone?.objectInstanceIds?.length ?? 0
}

function getBattlefieldInstanceIds(
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

function getGraveyardInstanceIds(
  state: GameState,
  ownerSeatId: number,
): number[] {
  const zone = Object.values(state.zones).find(
    (z) => z.type === "ZoneType_Graveyard" && z.ownerSeatId === ownerSeatId,
  )
  return zone?.objectInstanceIds ?? []
}

function getExileInstanceIds(state: GameState, ownerSeatId: number): number[] {
  const zone = Object.values(state.zones).find(
    (z) => z.type === "ZoneType_Exile" && z.ownerSeatId === ownerSeatId,
  )
  return zone?.objectInstanceIds ?? []
}

function getRevealedInstanceIds(
  state: GameState,
  ownerSeatId: number,
): number[] {
  const zone = Object.values(state.zones).find(
    (z) => z.type === "ZoneType_Revealed" && z.ownerSeatId === ownerSeatId,
  )
  return zone?.objectInstanceIds ?? []
}

// ============================================================
// Card resolvers
// ============================================================

function resolveBattlefieldCard(
  instanceId: number,
  state: GameState,
): BattlefieldCard | null {
  const obj = state.gameObjects[instanceId]
  if (!obj) return null

  const card = lookupCard(obj.grpId)
  if (!card) return null

  return {
    instanceId,
    name: card.name,
    manaCost: card.manaCost,
    typeLine: card.typeLine,
    subtypeLine: card.subtypeLine,
    power: obj.power?.value?.toString() ?? card.power,
    toughness: obj.toughness?.value?.toString() ?? card.toughness,
    abilities: card.abilities.map((a) => a.text),
    isTapped: obj.isTapped ?? false,
    hasSummoningSickness: obj.hasSummoningSickness ?? false,
    isAttacking: obj.attackState === "AttackState_Attacking",
  }
}

function resolveHandCard(
  instanceId: number,
  state: GameState,
): HandCard | null {
  const obj = state.gameObjects[instanceId]
  if (!obj) return null

  const card = lookupCard(obj.grpId)
  if (!card) return null

  // Check if this card appears in availableActions as castable
  const canCast =
    state.pendingDecision?.type === "ActionsAvailable" &&
    state.pendingDecision.actions.some(
      (a) => a.instanceId === instanceId && a.actionType === "ActionType_Cast",
    )

  // Check if this card appears in availableActions as playable
  const canPlay =
    state.pendingDecision?.type === "ActionsAvailable" &&
    state.pendingDecision.actions.some(
      (a) => a.instanceId === instanceId && a.actionType === "ActionType_Play",
    )

  return {
    instanceId,
    name: card.name,
    manaCost: card.manaCost,
    typeLine: card.typeLine,
    subtypeLine: card.subtypeLine,
    power: card.power,
    toughness: card.toughness,
    abilities: card.abilities.map((a) => a.text),
    canCast,
    canPlay,
  }
}

function resolveStackEntry(
  instanceId: number,
  state: GameState,
): StackEntry | null {
  const obj = state.gameObjects[instanceId]
  if (!obj) return null

  // For abilities, objectSourceGrpId is the source card
  const lookupGrpId = obj.objectSourceGrpId ?? obj.grpId
  const card = lookupCard(lookupGrpId)
  if (!card) return null

  return {
    instanceId,
    name: card.name,
    manaCost: card.manaCost,
    typeLine: card.typeLine,
    controlledByLocalPlayer: obj.controllerSeatId === state.localPlayerSeatId,
  }
}

// ============================================================
// Decision builder
// ============================================================

function buildDecision(pending: PendingDecision, state: GameState): Decision {
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
        const card = obj ? lookupCard(obj.grpId) : null
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
        actions: [...otherStrings, ...collapseManaActions(manaActions)],
      }
    }

    case "DeclareAttackers": {
      const attackers = pending.eligibleAttackers.map((a) => {
        const obj = state.gameObjects[a.attackerInstanceId]
        const card = obj ? lookupCard(obj.grpId) : null
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
        const card = obj ? lookupCard(obj.grpId) : null
        const attackers = b.attackerInstanceIds.map((id) => {
          const aObj = state.gameObjects[id]
          const aCard = aObj ? lookupCard(aObj.grpId) : null
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
      const sourceCard = sourceObj ? lookupCard(sourceObj.grpId) : null
      const slots = pending.targetSlots.map((slot) => ({
        targetIdx: slot.targetIdx,
        minTargets: slot.minTargets ?? 1,
        maxTargets: slot.maxTargets ?? 1,
        options: (slot.targets ?? []).map((t) => {
          const tObj = state.gameObjects[t.targetInstanceId ?? -1]
          const tCard = tObj ? lookupCard(tObj.grpId) : null
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
        const card = obj ? lookupCard(obj.grpId) : null
        return card?.name ?? `Unknown (instance ${a.instanceId})`
      })
      return { type: "PayCosts", cost, paymentOptions: options }
    }

    case "AssignDamage": {
      const assigners = pending.damageAssigners.map((d) => {
        const obj = state.gameObjects[d.instanceId]
        const card = obj ? lookupCard(obj.grpId) : null
        const assignments = d.assignments.map((a) => {
          // instanceId 1 or 2 = player seat, otherwise a creature
          const isPlayer = a.instanceId <= 2
          const aObj = isPlayer ? null : state.gameObjects[a.instanceId]
          const aCard = aObj ? lookupCard(aObj.grpId) : null
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
        const card = obj ? lookupCard(obj.grpId) : null
        return card?.name ?? `Unknown (instance ${id})`
      })
      return { type: "Mulligan", mulliganCount: pending.mulliganCount, cards }
    }

    case "LondonMulliganGroup": {
      const cards = pending.instanceIds.map((id) => {
        const obj = state.gameObjects[id]
        const card = obj ? lookupCard(obj.grpId) : null
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

function buildSnapshot(state: GameState): CoachingSnapshot | null {
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
    .map((id) => resolveBattlefieldCard(id, state))
    .filter((c): c is BattlefieldCard => c !== null)

  const opponentBattlefield = getBattlefieldInstanceIds(state, opponentSeatId)
    .map((id) => resolveBattlefieldCard(id, state))
    .filter((c): c is BattlefieldCard => c !== null)

  // ---- Hand ----
  const localHand = getHandInstanceIds(state, localSeatId)
    .map((id) => resolveHandCard(id, state))
    .filter((c): c is HandCard => c !== null)

  const localRevealed = getRevealedInstanceIds(state, localSeatId)
    .map((id) => resolveBattlefieldCard(id, state))
    .filter((c): c is BattlefieldCard => c !== null)

  const opponentHandSize = getHandInstanceIds(state, opponentSeatId).length
  const opponentRevealed = getRevealedInstanceIds(state, opponentSeatId)
    .map((id) => resolveBattlefieldCard(id, state))
    .filter((c): c is BattlefieldCard => c !== null)

  // ---- Graveyard / Exile ----
  const localGraveyard = getGraveyardInstanceIds(state, localSeatId)
    .map((id) => resolveBattlefieldCard(id, state))
    .filter((c): c is BattlefieldCard => c !== null)

  const localExile = getExileInstanceIds(state, localSeatId)
    .map((id) => resolveBattlefieldCard(id, state))
    .filter((c): c is BattlefieldCard => c !== null)

  const opponentGraveyard = getGraveyardInstanceIds(state, opponentSeatId)
    .map((id) => resolveBattlefieldCard(id, state))
    .filter((c): c is BattlefieldCard => c !== null)

  const opponentExile = getExileInstanceIds(state, opponentSeatId)
    .map((id) => resolveBattlefieldCard(id, state))
    .filter((c): c is BattlefieldCard => c !== null)

  // ---- Stack ----
  const stack = (state.stack ?? [])
    .map((id) => resolveStackEntry(id, state))
    .filter((e): e is StackEntry => e !== null)

  // ---- Decision ----
  const decision = buildDecision(state.pendingDecision, state)

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

// ============================================================
// Service lifecycle
// ============================================================

let unsubscribeDecision: (() => void) | null = null
let unsubscribeGameReset: (() => void) | null = null

export function startCoachingSnapshotService() {
  unsubscribeGameReset = gameStateEvents.on("gameReset", () => {
    latestSnapshot = null
  })

  // Only build snapshots when the player has decisions to make
  unsubscribeDecision = gameStateEvents.on(
    "decisionRequired",
    (state: GameState) => {
      const snapshot = buildSnapshot(state)
      if (snapshot) {
        latestSnapshot = snapshot
        coachingEvents.emit("snapshotReady", snapshot)
      }
    },
  )
}

export function stopCoachingSnapshotService() {
  unsubscribeDecision?.()
  unsubscribeDecision = null
  unsubscribeGameReset?.()
  unsubscribeGameReset = null
}

export function getLatestSnapshot(): CoachingSnapshot | null {
  return latestSnapshot
}
