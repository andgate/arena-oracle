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
