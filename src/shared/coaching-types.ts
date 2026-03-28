import { ResolvedCard } from "./card-types"
import { GameState } from "./game-state-types"
import { TGameObject } from "./gre/gre-types"

// ============================================================
// Card types
// ============================================================

export interface BattlefieldCard {
  instanceId: number
  name: string
  manaCost: string
  typeLine: string
  subtypeLine: string
  power: string
  toughness: string
  abilities: string[]
  isTapped: boolean
  hasSummoningSickness: boolean
  isAttacking: boolean
}

export interface HandCard {
  instanceId: number
  name: string
  manaCost: string
  typeLine: string
  subtypeLine: string
  power: string
  toughness: string
  abilities: string[]
  canCast: boolean
  canPlay: boolean
}

export interface StackEntry {
  instanceId: number
  name: string
  manaCost: string
  typeLine: string
  controlledByLocalPlayer: boolean
}

// ============================================================
// Player snapshot
// ============================================================

export interface PlayerSnapshot {
  lifeTotal: number
  isLocalPlayer: boolean
  battlefield: BattlefieldCard[]
  hand: HandCard[]
  handSize: number
  revealed: BattlefieldCard[] // cards revealed from hand or library — isTapped/hasSummoningSickness are always false here
  librarySize: number
  graveyard: BattlefieldCard[]
  graveyardSize: number
  exile: BattlefieldCard[]
  exileSize: number
}

// ============================================================
// Decision — what the player is currently being asked to do
// ============================================================

export interface AttackerOption {
  instanceId: number
  name: string
  power: string
  toughness: string
  isTapped: boolean
}

export interface BlockerOption {
  instanceId: number
  name: string
  power: string
  toughness: string
  attackers: {
    instanceId: number
    name: string
    power: string
    toughness: string
  }[]
}

export interface TargetOption {
  instanceId: number
  name: string
}

export interface TargetSlot {
  targetIdx: number
  minTargets: number
  maxTargets: number
  options: TargetOption[]
}

export interface DamageAssignment {
  targetName: string
  minDamage: number
  maxDamage: number
  assignedDamage: number
}

export interface DamageAssigner {
  attackerName: string
  totalDamage: number
  assignments: DamageAssignment[]
}

export type Decision =
  | { type: "ActionsAvailable"; actions: string[] }
  | { type: "DeclareAttackers"; eligibleAttackers: AttackerOption[] }
  | { type: "DeclareBlockers"; eligibleBlockers: BlockerOption[] }
  | { type: "SelectTargets"; sourceName: string; targetSlots: TargetSlot[] }
  | { type: "PayCosts"; cost: string; paymentOptions: string[] }
  | { type: "AssignDamage"; damageAssigners: DamageAssigner[] }
  | { type: "Mulligan"; mulliganCount: number; cards: string[] }
  | { type: "LondonMulliganGroup"; cards: string[]; keepCount: number }

// ============================================================
// Coaching snapshot
// ============================================================

export interface CoachingSnapshot {
  turnNumber: number
  phase: string
  step: string | null
  isLocalPlayerTurn: boolean
  localPlayer: PlayerSnapshot
  opponent: PlayerSnapshot
  stack: StackEntry[]
  decision: Decision
}

// ============================================================
// Constructors
// ============================================================

export function makeBattlefieldCard(
  instanceId: number,
  obj: TGameObject,
  card: ResolvedCard,
): BattlefieldCard {
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

export function makeHandCard(
  instanceId: number,
  card: ResolvedCard,
  state: GameState,
): HandCard {
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

export function makeStackEntry(
  instanceId: number,
  obj: TGameObject,
  state: GameState,
  card: ResolvedCard,
): StackEntry {
  return {
    instanceId,
    name: card.name,
    manaCost: card.manaCost,
    typeLine: card.typeLine,
    controlledByLocalPlayer: obj.controllerSeatId === state.localPlayerSeatId,
  }
}
