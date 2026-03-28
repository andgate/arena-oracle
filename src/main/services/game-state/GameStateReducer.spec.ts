import { GameState } from "@shared/game-state-types"
import { TGREMessage, TGameObject } from "@shared/gre/gre-types"
import { describe, expect, it } from "vitest"
import { Effect, GameStateReducer, initialGameState } from "./GameStateReducer"

function state(overrides: Partial<GameState> = {}): GameState {
  return { ...initialGameState(), ...overrides }
}

function gameStateMsg(
  gameStateId: number,
  overrides: Partial<
    Extract<
      TGREMessage,
      { type: "GREMessageType_GameStateMessage" }
    >["gameStateMessage"]
  > = {},
): Extract<TGREMessage, { type: "GREMessageType_GameStateMessage" }> {
  return {
    type: "GREMessageType_GameStateMessage",
    systemSeatIds: [1],
    msgId: 1,
    gameStateId,
    gameStateMessage: {
      type: "GameStateType_Diff",
      gameStateId,
      ...overrides,
    },
  }
}

function connectRespMsg(): Extract<
  TGREMessage,
  { type: "GREMessageType_ConnectResp" }
> {
  return {
    type: "GREMessageType_ConnectResp",
    systemSeatIds: [1],
    msgId: 1,
    gameStateId: 0,
  }
}

function effectTypes(effects: Effect[]): string[] {
  return effects.map((effect) => effect.type)
}

const reducer = new GameStateReducer()

describe("reduceMessage - ConnectResp", () => {
  it("resets state to initial and emits gameReset", () => {
    const s = state({ gameStateId: 100, localPlayerSeatId: 1 })
    const result = reducer.reduceMessage(s, "someKey", connectRespMsg())

    expect(result.state).toEqual(initialGameState())
    expect(result.lastDecisionKey).toBe("")
    expect(effectTypes(result.effects)).toEqual(["gameReset"])
  })
})

describe("reduceMessage - GameStateMessage / applyDiff", () => {
  it("upserts game objects into gameObjects", () => {
    const obj: TGameObject = {
      instanceId: 1,
      grpId: 42,
      type: "GameObjectType_Card",
      zoneId: 10,
      visibility: "Visibility_Public",
      ownerSeatId: 1,
      controllerSeatId: 1,
      cardTypes: [],
      subtypes: [],
      superTypes: [],
      color: [],
      abilities: [],
      name: 100,
      overlayGrpId: 0,
    }
    const result = reducer.reduceMessage(
      state(),
      "",
      gameStateMsg(1, { gameObjects: [obj] }),
    )

    expect(result.state.gameObjects[1]).toMatchObject({
      instanceId: 1,
      grpId: 42,
    })
  })

  it("removes objects listed in diffDeletedInstanceIds", () => {
    const existingObject = (
      instanceId: number,
      zoneId: number,
    ): TGameObject => ({
      instanceId,
      grpId: instanceId + 100,
      type: "GameObjectType_Card",
      zoneId,
      visibility: "Visibility_Public",
      ownerSeatId: 1,
      controllerSeatId: 1,
      cardTypes: [],
      subtypes: [],
      superTypes: [],
      color: [],
      abilities: [],
      name: instanceId + 1000,
      overlayGrpId: 0,
    })

    const s = state({
      gameObjects: {
        1: existingObject(1, 10),
        2: existingObject(2, 11),
      },
      gameStateId: 1,
    })
    const result = reducer.reduceMessage(
      s,
      "",
      gameStateMsg(2, { diffDeletedInstanceIds: [1] }),
    )

    expect(result.state.gameObjects[1]).toBeUndefined()
    expect(result.state.gameObjects[2]).toBeDefined()
  })

  it("updates zones", () => {
    const zone = {
      zoneId: 10,
      type: "ZoneType_Hand" as const,
      visibility: "Visibility_Private" as const,
      ownerSeatId: 1,
      objectInstanceIds: [5, 6],
    }
    const result = reducer.reduceMessage(state(), "", gameStateMsg(1, { zones: [zone] }))

    expect(result.state.zones[10]).toMatchObject({ zoneId: 10, ownerSeatId: 1 })
  })

  it("derives stack from ZoneType_Stack", () => {
    const stackZone = {
      zoneId: 99,
      type: "ZoneType_Stack" as const,
      visibility: "Visibility_Public" as const,
      objectInstanceIds: [7, 8],
    }
    const result = reducer.reduceMessage(
      state(),
      "",
      gameStateMsg(1, { zones: [stackZone] }),
    )

    expect(result.state.stack).toEqual([7, 8])
  })

  it("merges players and preserves existing fields", () => {
    const s = state({
      gameStateId: 1,
      players: {
        1: {
          systemSeatNumber: 1,
          lifeTotal: 20,
          maxHandSize: 7,
          mulliganCount: 0,
          timerIds: [],
        },
      },
    })
    const result = reducer.reduceMessage(
      s,
      "",
      gameStateMsg(2, {
        players: [
          {
            systemSeatNumber: 1,
            lifeTotal: 14,
            maxHandSize: 7,
            mulliganCount: 0,
            timerIds: [],
          },
        ],
      }),
    )

    expect(result.state.players[1].lifeTotal).toBe(14)
    expect(result.state.players[1].maxHandSize).toBe(7)
  })

  it("uses seatId when systemSeatNumber is absent", () => {
    const result = reducer.reduceMessage(
      state(),
      "",
      gameStateMsg(1, {
        players: [
          {
            seatId: 2,
            lifeTotal: 19,
            maxHandSize: 7,
            mulliganCount: 0,
            timerIds: [],
          },
        ],
      }),
    )

    expect(result.state.players[2]).toMatchObject({
      seatId: 2,
      lifeTotal: 19,
    })
  })

  it("ignores players that have neither systemSeatNumber nor seatId", () => {
    const result = reducer.reduceMessage(
      state(),
      "",
      gameStateMsg(1, {
        players: [
          {
            lifeTotal: 19,
            maxHandSize: 7,
            mulliganCount: 0,
            timerIds: [],
          },
        ],
      }),
    )

    expect(result.state.players).toEqual({})
  })

  it("updates turnInfo when present", () => {
    const turnInfo = {
      turnNumber: 3,
      phase: "Phase_Main1" as const,
      activePlayer: 1,
      priorityPlayer: 1,
    }
    const result = reducer.reduceMessage(state(), "", gameStateMsg(1, { turnInfo }))

    expect(result.state.turnInfo).toMatchObject({
      turnNumber: 3,
      phase: "Phase_Main1",
    })
  })

  it("advances gameStateId", () => {
    const result = reducer.reduceMessage(
      state({ gameStateId: 5 }),
      "",
      gameStateMsg(6),
    )
    expect(result.state.gameStateId).toBe(6)
  })

  it("emits stateUpdated effect when diff is applied", () => {
    const result = reducer.reduceMessage(state(), "", gameStateMsg(1))
    expect(effectTypes(result.effects)).toContain("stateUpdated")
  })

  it("ignores duplicate diffs with same gameStateId", () => {
    const s = state({ gameStateId: 5 })
    const result = reducer.reduceMessage(s, "", gameStateMsg(5))

    expect(result.state).toBe(s)
    expect(result.effects).toHaveLength(0)
  })

  it("ignores diffs with lower gameStateId", () => {
    const s = state({ gameStateId: 10 })
    const result = reducer.reduceMessage(s, "", gameStateMsg(4))

    expect(result.state).toBe(s)
    expect(result.effects).toHaveLength(0)
  })

  it("emits gameReset and clears state when gameStateId resets to a low value", () => {
    const s = state({ gameStateId: 100 })
    const result = reducer.reduceMessage(s, "", gameStateMsg(3))

    expect(effectTypes(result.effects)).toEqual(["gameReset"])
    expect(result.state).toEqual(initialGameState())
  })

  it("resets lastDecisionKey on new game", () => {
    const s = state({ gameStateId: 100 })
    const result = reducer.reduceMessage(s, "100:ActionsAvailable", gameStateMsg(3))

    expect(result.lastDecisionKey).toBe("")
  })
})

describe("reduceMessage - buildDecision", () => {
  const BASE_STATE = state({ localPlayerSeatId: 1, gameStateId: 1 })

  function decisionMsg<T extends TGREMessage>(msg: T) {
    return reducer.reduceMessage(BASE_STATE, "", msg)
  }

  it("ActionsAvailable emits decisionRequired and populates availableActions", () => {
    const action = { actionType: "ActionType_Pass" as const }
    const msg: TGREMessage = {
      type: "GREMessageType_ActionsAvailableReq",
      systemSeatIds: [1],
      msgId: 1,
      gameStateId: 2,
      actionsAvailableReq: { actions: [action] },
    }
    const result = decisionMsg(msg)

    expect(effectTypes(result.effects)).toEqual(["decisionRequired"])
    expect(result.state.pendingDecision).toMatchObject({
      type: "ActionsAvailable",
      actions: [action],
    })
    expect(result.state.availableActions).toEqual([action])
  })

  it("DeclareAttackers sets eligibleAttackers and clears availableActions", () => {
    const attacker = { attackerInstanceId: 5 }
    const msg: TGREMessage = {
      type: "GREMessageType_DeclareAttackersReq",
      systemSeatIds: [1],
      msgId: 1,
      gameStateId: 2,
      declareAttackersReq: { attackers: [], qualifiedAttackers: [attacker] },
    }
    const result = decisionMsg(msg)

    expect(result.state.pendingDecision).toMatchObject({
      type: "DeclareAttackers",
      eligibleAttackers: [attacker],
    })
    expect(result.state.availableActions).toEqual([])
  })

  it("DeclareBlockers sets eligibleBlockers", () => {
    const blocker = { blockerInstanceId: 3, attackerInstanceIds: [5] }
    const msg: TGREMessage = {
      type: "GREMessageType_DeclareBlockersReq",
      systemSeatIds: [1],
      msgId: 1,
      gameStateId: 2,
      declareBlockersReq: { blockers: [blocker] },
    }
    const result = decisionMsg(msg)

    expect(result.state.pendingDecision).toMatchObject({
      type: "DeclareBlockers",
      eligibleBlockers: [blocker],
    })
  })

  it("SelectTargets sets sourceId, abilityGrpId, and targetSlots", () => {
    const slot = { targetIdx: 0 }
    const msg: TGREMessage = {
      type: "GREMessageType_SelectTargetsReq",
      systemSeatIds: [1],
      msgId: 1,
      gameStateId: 2,
      selectTargetsReq: { targets: [slot], sourceId: 10, abilityGrpId: 20 },
    }
    const result = decisionMsg(msg)

    expect(result.state.pendingDecision).toMatchObject({
      type: "SelectTargets",
      sourceId: 10,
      abilityGrpId: 20,
      targetSlots: [slot],
    })
  })

  it("PayCosts sets manaCost and paymentActions", () => {
    const cost = { color: ["ManaColor_Red" as const], count: 1 }
    const action = { actionType: "ActionType_Activate_Mana" as const }
    const msg: TGREMessage = {
      type: "GREMessageType_PayCostsReq",
      systemSeatIds: [1],
      msgId: 1,
      gameStateId: 2,
      payCostsReq: {
        manaCost: [cost],
        paymentActions: { actions: [action] },
      },
    }
    const result = decisionMsg(msg)

    expect(result.state.pendingDecision).toMatchObject({
      type: "PayCosts",
      manaCost: [cost],
      paymentActions: [action],
    })
  })

  it("PayCosts falls back to empty arrays when fields are omitted", () => {
    const msg: TGREMessage = {
      type: "GREMessageType_PayCostsReq",
      systemSeatIds: [1],
      msgId: 1,
      gameStateId: 2,
      payCostsReq: {},
    }
    const result = decisionMsg(msg)

    expect(result.state.pendingDecision).toMatchObject({
      type: "PayCosts",
      manaCost: [],
      paymentActions: [],
    })
  })

  it("AssignDamage sets damageAssigners", () => {
    const assigner = {
      instanceId: 7,
      totalDamage: 3,
      assignments: [{ instanceId: 8, assignedDamage: 3 }],
    }
    const msg: TGREMessage = {
      type: "GREMessageType_AssignDamageReq",
      systemSeatIds: [1],
      msgId: 1,
      gameStateId: 2,
      assignDamageReq: { damageAssigners: [assigner] },
    }
    const result = decisionMsg(msg)

    expect(result.state.pendingDecision).toMatchObject({
      type: "AssignDamage",
      damageAssigners: [assigner],
    })
  })

  it("MulliganReq looks up handInstanceIds from the local player's hand zone", () => {
    const handZone = {
      zoneId: 50,
      type: "ZoneType_Hand" as const,
      visibility: "Visibility_Private" as const,
      ownerSeatId: 1,
      objectInstanceIds: [11, 12, 13],
    }
    const s = state({
      localPlayerSeatId: 1,
      gameStateId: 1,
      zones: { 50: handZone },
    })
    const msg: TGREMessage = {
      type: "GREMessageType_MulliganReq",
      systemSeatIds: [1],
      msgId: 1,
      gameStateId: 2,
      mulliganReq: { mulliganType: "MulliganType_London", mulliganCount: 1 },
    }
    const result = reducer.reduceMessage(s, "", msg)

    expect(result.state.pendingDecision).toMatchObject({
      type: "Mulligan",
      mulliganCount: 1,
      handInstanceIds: [11, 12, 13],
    })
  })

  it("MulliganReq falls back to 0 mulliganCount and empty hand when fields are missing", () => {
    const msg: TGREMessage = {
      type: "GREMessageType_MulliganReq",
      systemSeatIds: [1],
      msgId: 1,
      gameStateId: 2,
      mulliganReq: { mulliganType: "MulliganType_London" },
    }
    const result = decisionMsg(msg)

    expect(result.state.pendingDecision).toMatchObject({
      type: "Mulligan",
      mulliganCount: 0,
      handInstanceIds: [],
    })
  })

  it("GroupReq with LondonMulligan context sets instanceIds and keepCount", () => {
    const msg: TGREMessage = {
      type: "GREMessageType_GroupReq",
      systemSeatIds: [1],
      msgId: 1,
      gameStateId: 2,
      groupReq: {
        instanceIds: [1, 2, 3, 4, 5, 6, 7],
        groupSpecs: [
          { zoneType: "ZoneType_Hand", lowerBound: 6, upperBound: 6 },
          { zoneType: "ZoneType_Library", lowerBound: 1, upperBound: 1 },
        ],
        groupType: "GroupType_Ordered",
        context: "GroupingContext_LondonMulligan",
      },
    }
    const result = decisionMsg(msg)

    expect(result.state.pendingDecision).toMatchObject({
      type: "LondonMulliganGroup",
      instanceIds: [1, 2, 3, 4, 5, 6, 7],
      keepCount: 6,
    })
  })

  it("GroupReq with LondonMulligan context falls back to instance count when no hand groupSpec exists", () => {
    const msg: TGREMessage = {
      type: "GREMessageType_GroupReq",
      systemSeatIds: [1],
      msgId: 1,
      gameStateId: 2,
      groupReq: {
        instanceIds: [1, 2, 3],
        groupSpecs: [
          { zoneType: "ZoneType_Library", lowerBound: 1, upperBound: 1 },
        ],
        groupType: "GroupType_Ordered",
        context: "GroupingContext_LondonMulligan",
      },
    }
    const result = decisionMsg(msg)

    expect(result.state.pendingDecision).toMatchObject({
      type: "LondonMulliganGroup",
      instanceIds: [1, 2, 3],
      keepCount: 3,
    })
  })

  it("GroupReq with other context produces no decision", () => {
    const msg: TGREMessage = {
      type: "GREMessageType_GroupReq",
      systemSeatIds: [1],
      msgId: 1,
      gameStateId: 2,
      groupReq: {
        instanceIds: [1, 2],
        groupSpecs: [
          { zoneType: "ZoneType_Hand", lowerBound: 1, upperBound: 1 },
        ],
        groupType: "GroupType_Ordered",
        context: "GroupingContext_Other",
      },
    }
    const result = decisionMsg(msg)

    expect(result.state.pendingDecision).toBeNull()
    expect(effectTypes(result.effects)).not.toContain("decisionRequired")
  })

  it("unknown message types leave state unchanged", () => {
    const s = BASE_STATE
    const msg = {
      type: "GREMessageType_SomeUnknownType",
      systemSeatIds: [1],
    } as unknown as TGREMessage
    const result = reducer.reduceMessage(s, "", msg)

    expect(result.state).toBe(s)
    expect(result.effects).toHaveLength(0)
  })
})

describe("reduceMessage - decision deduplication", () => {
  const passMsg = (gameStateId: number): TGREMessage => ({
    type: "GREMessageType_ActionsAvailableReq",
    systemSeatIds: [1],
    msgId: 1,
    gameStateId,
    actionsAvailableReq: { actions: [] },
  })

  it("does not emit decisionRequired for the same gameStateId and type key twice", () => {
    const s = state()
    const first = reducer.reduceMessage(s, "", passMsg(5))
    const second = reducer.reduceMessage(
      first.state,
      first.lastDecisionKey,
      passMsg(5),
    )

    expect(effectTypes(second.effects)).not.toContain("decisionRequired")
    expect(second.effects).toHaveLength(0)
  })

  it("emits decisionRequired when the key changes", () => {
    const s = state()
    const first = reducer.reduceMessage(s, "", passMsg(5))
    const second = reducer.reduceMessage(
      first.state,
      first.lastDecisionKey,
      passMsg(6),
    )

    expect(effectTypes(second.effects)).toContain("decisionRequired")
  })
})
