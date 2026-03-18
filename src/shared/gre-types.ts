import { z } from "zod"

// ============================================================
// Enums
// ============================================================

const Zone = z.enum([
  "ZoneType_Stack",
  "ZoneType_Battlefield",
  "ZoneType_Hand",
  "ZoneType_Library",
  "ZoneType_Graveyard",
  "ZoneType_Exile",
  "ZoneType_Limbo",
  "ZoneType_Revealed",
  "ZoneType_Suppressed",
  "ZoneType_Pending",
  "ZoneType_Command",
  "ZoneType_Sideboard",
])

const Phase = z.enum([
  "Phase_Beginning",
  "Phase_Main1",
  "Phase_Combat",
  "Phase_Main2",
  "Phase_Ending",
])

const Step = z.enum([
  "Step_Upkeep",
  "Step_Draw",
  "Step_BeginCombat",
  "Step_DeclareAttack",
  "Step_DeclareBlock",
  "Step_CombatDamage",
  "Step_EndCombat",
  "Step_End",
  "Step_Cleanup",
])

const CardColor = z.enum([
  "CardColor_White",
  "CardColor_Blue",
  "CardColor_Black",
  "CardColor_Red",
  "CardColor_Green",
  "CardColor_Colorless",
])

const ManaColor = z.enum([
  "ManaColor_White",
  "ManaColor_Blue",
  "ManaColor_Black",
  "ManaColor_Red",
  "ManaColor_Green",
  "ManaColor_Generic",
  "ManaColor_Colorless",
])

const CardType = z.enum([
  "CardType_Creature",
  "CardType_Land",
  "CardType_Instant",
  "CardType_Sorcery",
  "CardType_Enchantment",
  "CardType_Artifact",
  "CardType_Planeswalker",
])

const ActionType = z.enum([
  "ActionType_Cast",
  "ActionType_Play",
  "ActionType_Activate_Mana",
  "ActionType_Activate",
  "ActionType_Pass",
  "ActionType_FloatMana",
])

const Visibility = z.enum([
  "Visibility_Public",
  "Visibility_Private",
  "Visibility_Hidden",
])

// ============================================================
// Shared building blocks
// ============================================================

const ManaCost = z.object({
  color: z.array(ManaColor),
  count: z.number(),
})

const PowerToughness = z.object({
  value: z.number(),
})

const DamageRecipient = z.object({
  type: z.string(),
  playerSystemSeatId: z.number().optional(),
  instanceId: z.number().optional(),
})

const EligibleAttacker = z.object({
  attackerInstanceId: z.number(),
  legalDamageRecipients: z.array(DamageRecipient).optional(),
})

const EligibleBlocker = z.object({
  blockerInstanceId: z.number(),
  attackerInstanceIds: z.array(z.number()).default([]),
  maxAttackers: z.number().optional(),
})

const DamageAssignment = z.object({
  instanceId: z.number(),
  minDamage: z.number().optional(),
  maxDamage: z.number().optional(),
  assignedDamage: z.number(),
})

const DamageAssigner = z.object({
  instanceId: z.number(),
  totalDamage: z.number(),
  assignments: z.array(DamageAssignment),
  decisionPrompt: z
    .object({
      promptId: z.number(),
      parameters: z.array(z.any()).optional(),
    })
    .optional(),
})

// ============================================================
// Zone
// ============================================================

const ZoneState = z.object({
  zoneId: z.number(),
  type: Zone,
  visibility: Visibility,
  ownerSeatId: z.number().optional(),
  objectInstanceIds: z.array(z.number()).default([]),
  viewers: z.array(z.number()).optional(),
})

// ============================================================
// Game Object (card on battlefield, in hand, etc.)
// ============================================================

const GameObject = z
  .object({
    instanceId: z.number(),
    grpId: z.number(),
    type: z.string(),
    zoneId: z.number(),
    visibility: Visibility,
    ownerSeatId: z.number(),
    controllerSeatId: z.number(),
    cardTypes: z.array(CardType).default([]),
    subtypes: z.array(z.string()).default([]),
    superTypes: z.array(z.string()).default([]),
    color: z.array(CardColor).default([]),
    power: PowerToughness.optional(),
    toughness: PowerToughness.optional(),
    abilities: z.array(z.number()).default([]),
    isTapped: z.boolean().optional(),
    hasSummoningSickness: z.boolean().optional(),
    name: z.number(),
    overlayGrpId: z.number(),
    viewers: z.array(z.number()).optional(),
    uniqueAbilities: z
      .array(
        z.object({
          id: z.number().optional(),
          grpId: z.number(),
        }),
      )
      .optional(),
    attackState: z.string().optional(),
    blockState: z.string().optional(),
    damage: z.number().optional(),
    attackInfo: z
      .object({
        targetId: z.number(),
        damageAssigned: z.boolean().optional(),
      })
      .optional(),
    parentId: z.number().optional(),
    objectSourceGrpId: z.number().optional(),
  })
  .catchall(z.unknown())

// ============================================================
// Player
// ============================================================

const PlayerState = z.object({
  seatId: z.number().optional(), // sometimes implied by position in array
  systemSeatNumber: z.number().optional(),
  lifeTotal: z.number(),
  maxHandSize: z.number(),
  mulliganCount: z.number(),
  turnNumber: z.number().optional(),
  teamId: z.number().optional(),
  timerIds: z.array(z.number()).default([]),
  controllerSeatId: z.number().optional(),
  controllerType: z.string().optional(),
  startingLifeTotal: z.number().optional(),
  status: z.string().optional(),
})

// ============================================================
// Turn Info
// ============================================================

const TurnInfo = z.object({
  turnNumber: z.number(),
  phase: Phase,
  step: Step.optional(),
  activePlayer: z.number(),
  priorityPlayer: z.number(),
  decisionPlayer: z.number().optional(),
  nextPhase: Phase.optional(),
  nextStep: Step.optional(),
})

// ============================================================
// Actions
// ============================================================

const TargetOption = z.object({
  targetInstanceId: z.number().optional(),
  legalAction: z.string().optional(),
  highlight: z.string().optional(),
})

const TargetSlot = z.object({
  targetIdx: z.number(),
  targets: z.array(TargetOption).optional(),
  minTargets: z.number().optional(),
  maxTargets: z.number().optional(),
  targetingAbilityGrpId: z.number().optional(),
  targetingPlayer: z.number().optional(),
  prompt: z
    .object({
      promptId: z.number(),
      parameters: z.array(z.any()).optional(),
    })
    .optional(),
})

const ManaSelection = z.object({
  instanceId: z.number(),
  abilityGrpId: z.number(),
  options: z.array(z.object({ mana: z.array(ManaCost) })),
})

const AvailableAction = z.object({
  actionType: ActionType,
  grpId: z.number().optional(),
  instanceId: z.number().optional(),
  facetId: z.number().optional(),
  abilityGrpId: z.number().optional(),
  manaCost: z.array(ManaCost).optional(),
  targets: z.array(TargetSlot).optional(),
  manaPaymentOptions: z.array(z.object({ mana: z.array(z.any()) })).optional(),
  manaSelections: z.array(ManaSelection).optional(),
  isBatchable: z.boolean().optional(),
  shouldStop: z.boolean().optional(),
})

// ============================================================
// Annotations (zone transfers, taps, etc.)
// ============================================================

const AnnotationDetail = z.object({
  key: z.string(),
  type: z.string(),
  valueInt32: z.array(z.number()).optional(),
  valueString: z.array(z.string()).optional(),
})

const Annotation = z.object({
  id: z.number(),
  affectorId: z.number().optional(),
  affectedIds: z.array(z.number()),
  type: z.array(z.string()),
  details: z.array(AnnotationDetail).optional(),
})

// ============================================================
// GRE Message types
// ============================================================

const GameStateDiff = z.object({
  type: z.literal("GameStateType_Diff"),
  gameStateId: z.number(),
  prevGameStateId: z.number().optional(),
  turnInfo: TurnInfo.optional(),
  zones: z.array(ZoneState).optional(),
  gameObjects: z.array(GameObject).optional(),
  players: z.array(PlayerState).optional(),
  annotations: z.array(Annotation).optional(),
  actions: z
    .array(
      z.object({
        seatId: z.number(),
        action: AvailableAction,
      }),
    )
    .optional(),
  diffDeletedInstanceIds: z.array(z.number()).optional(),
  diffDeletedPersistentAnnotationIds: z.array(z.number()).optional(),
  persistentAnnotations: z.array(Annotation).optional(),
  update: z.string().optional(),
  timers: z.array(z.any()).optional(),
  pendingMessageCount: z.number().optional(),
})

const GameStateMessage = z.object({
  type: z.literal("GREMessageType_GameStateMessage"),
  systemSeatIds: z.array(z.number()),
  msgId: z.number(),
  gameStateId: z.number(),
  gameStateMessage: GameStateDiff,
})

const ActionsAvailableReq = z.object({
  type: z.literal("GREMessageType_ActionsAvailableReq"),
  systemSeatIds: z.array(z.number()),
  msgId: z.number(),
  gameStateId: z.number(),
  prompt: z.object({ promptId: z.number() }).optional(),
  actionsAvailableReq: z.object({
    actions: z.array(AvailableAction),
  }),
})

const DeclareAttackersReq = z.object({
  type: z.literal("GREMessageType_DeclareAttackersReq"),
  systemSeatIds: z.array(z.number()),
  msgId: z.number(),
  gameStateId: z.number(),
  declareAttackersReq: z.object({
    attackers: z.array(EligibleAttacker).default([]),
    qualifiedAttackers: z.array(EligibleAttacker).default([]),
    canSubmitAttackers: z.boolean().optional(),
    manaCost: z.array(z.any()).optional(),
  }),
})

const DeclareBlockersReq = z.object({
  type: z.literal("GREMessageType_DeclareBlockersReq"),
  systemSeatIds: z.array(z.number()),
  msgId: z.number(),
  gameStateId: z.number(),
  declareBlockersReq: z.object({
    blockers: z.array(EligibleBlocker).default([]),
    manaCost: z.array(z.any()).optional(),
  }),
})

const SelectTargetsReq = z.object({
  type: z.literal("GREMessageType_SelectTargetsReq"),
  systemSeatIds: z.array(z.number()),
  msgId: z.number(),
  gameStateId: z.number(),
  selectTargetsReq: z.object({
    targets: z.array(TargetSlot),
    sourceId: z.number().optional(),
    abilityGrpId: z.number().optional(),
  }),
  allowCancel: z.string().optional(),
  allowUndo: z.boolean().optional(),
})

const PayCostsReq = z.object({
  type: z.literal("GREMessageType_PayCostsReq"),
  systemSeatIds: z.array(z.number()),
  msgId: z.number(),
  gameStateId: z.number(),
  payCostsReq: z.object({
    manaCost: z.array(ManaCost).optional(),
    paymentActions: z
      .object({
        actions: z.array(AvailableAction),
      })
      .optional(),
  }),
  allowCancel: z.string().optional(),
  allowUndo: z.boolean().optional(),
})

const AssignDamageReq = z.object({
  type: z.literal("GREMessageType_AssignDamageReq"),
  systemSeatIds: z.array(z.number()),
  msgId: z.number(),
  gameStateId: z.number(),
  assignDamageReq: z.object({
    damageAssigners: z.array(DamageAssigner),
  }),
})

const ConnectResp = z
  .object({
    type: z.literal("GREMessageType_ConnectResp"),
    systemSeatIds: z.array(z.number()),
    msgId: z.number(),
    gameStateId: z.number(),
  })
  .catchall(z.unknown())

const MulliganReq = z.object({
  type: z.literal("GREMessageType_MulliganReq"),
  systemSeatIds: z.array(z.number()),
  msgId: z.number(),
  gameStateId: z.number(),
  prompt: z
    .object({
      promptId: z.number(),
      parameters: z.array(z.any()).optional(),
    })
    .optional(),
  mulliganReq: z.object({
    mulliganType: z.string(),
    mulliganCount: z.number().optional(), // absent on first mulligan offer
  }),
})

const GroupReq = z.object({
  type: z.literal("GREMessageType_GroupReq"),
  systemSeatIds: z.array(z.number()),
  msgId: z.number(),
  gameStateId: z.number(),
  prompt: z
    .object({
      promptId: z.number(),
      parameters: z.array(z.any()).optional(),
    })
    .optional(),
  groupReq: z.object({
    instanceIds: z.array(z.number()),
    groupSpecs: z.array(
      z.object({
        lowerBound: z.number(),
        upperBound: z.number(),
        zoneType: Zone,
        subZoneType: z.string().optional(),
      }),
    ),
    groupType: z.string(),
    context: z.string(),
    sourceId: z.number().optional(),
  }),
  allowCancel: z.string().optional(),
})

const UnknownMessage = z
  .object({
    type: z.string(),
  })
  .catchall(z.unknown())

const KnownGREMessage = z.discriminatedUnion("type", [
  GameStateMessage,
  ActionsAvailableReq,
  DeclareAttackersReq,
  DeclareBlockersReq,
  SelectTargetsReq,
  PayCostsReq,
  AssignDamageReq,
  ConnectResp,
  MulliganReq,
  GroupReq,
])

const GREMessage = z.union([KnownGREMessage, UnknownMessage])

const GreToClientEvent = z.object({
  transactionId: z.string(),
  requestId: z.number(),
  timestamp: z.string(),
  greToClientEvent: z.object({
    greToClientMessages: z.array(GREMessage),
  }),
})

// ============================================================
// Inferred types (no manual interfaces needed!)
// ============================================================

// Top-level event wrapper
export type TGreToClientEvent = z.infer<typeof GreToClientEvent>

// GRE messages
export type TGREMessage = z.infer<typeof KnownGREMessage>
export type TGameStateMessage = z.infer<typeof GameStateMessage>
export type TActionsAvailableReq = z.infer<typeof ActionsAvailableReq>
export type TDeclareAttackersReq = z.infer<typeof DeclareAttackersReq>
export type TDeclareBlockersReq = z.infer<typeof DeclareBlockersReq>
export type TSelectTargetsReq = z.infer<typeof SelectTargetsReq>
export type TPayCostsReq = z.infer<typeof PayCostsReq>
export type TAssignDamageReq = z.infer<typeof AssignDamageReq>
export type TConnectResp = z.infer<typeof ConnectResp>
export type TMulliganReq = z.infer<typeof MulliganReq>
export type TGroupReq = z.infer<typeof GroupReq>

// Game state
export type TGameStateDiff = z.infer<typeof GameStateDiff>
export type TGameState = z.infer<typeof GameStateDiff> // alias
export type TGameObject = z.infer<typeof GameObject>
export type TZoneState = z.infer<typeof ZoneState>
export type TPlayerState = z.infer<typeof PlayerState>
export type TTurnInfo = z.infer<typeof TurnInfo>

// Actions & decisions
export type TAvailableAction = z.infer<typeof AvailableAction>
export type TEligibleAttacker = z.infer<typeof EligibleAttacker>
export type TEligibleBlocker = z.infer<typeof EligibleBlocker>
export type TTargetSlot = z.infer<typeof TargetSlot>
export type TDamageAssigner = z.infer<typeof DamageAssigner>
export type TDamageAssignment = z.infer<typeof DamageAssignment>
export type TManaCost = z.infer<typeof ManaCost>

// ============================================================
// Parser
// ============================================================

export function parseLogLine(line: string): TGreToClientEvent | null {
  // Strip the UnityCrossThreadLogger prefix
  const jsonStart = line.indexOf("{")
  if (jsonStart === -1) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(line.slice(jsonStart))
  } catch {
    return null
  }

  // Only try to parse lines that look like GRE events
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("greToClientEvent" in parsed)
  ) {
    return null
  }

  const result = GreToClientEvent.safeParse(parsed)
  if (!result.success) {
    // Find which messages are failing
    const msgs = (parsed as any)?.greToClientEvent?.greToClientMessages ?? []
    msgs.forEach((msg: any, i: number) => {
      const t = msg?.type ?? "unknown"
      console.warn(
        `GRE parse error on message[${i}] type=${t}:`,
        JSON.stringify(result.error.flatten(), null, 2),
      )
    })
    return null
  }

  return result.data
}
