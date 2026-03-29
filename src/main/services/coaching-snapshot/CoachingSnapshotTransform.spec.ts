import type { ICardDbService } from "@main/services/card-db/CardDbService.interface"
import { CoachingSnapshotTransform } from "@main/services/coaching-snapshot/CoachingSnapshotTransform"
import type { ResolvedCard } from "@shared/card-types"
import type { GameState, PendingDecision } from "@shared/game-state-types"
import * as greFormatting from "@shared/gre/gre-formatting"
import type {
  TGameObject,
  TManaCost,
  TPlayerState,
  TTurnInfo,
  TZoneState,
} from "@shared/gre/gre-types"
import { beforeEach, describe, expect, it, vi } from "vitest"

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@shared/gre/gre-formatting", () => ({
  formatManaCost: vi.fn().mockReturnValue("{G}"),
  getManaColorString: vi.fn().mockReturnValue("{G}"),
}))

// ─── Factories ───────────────────────────────────────────────────────────────

function makeResolvedCard(overrides: Partial<ResolvedCard> = {}): ResolvedCard {
  return {
    grpId: 1,
    name: "Llanowar Elves",
    manaCost: "{G}",
    typeLine: "Creature",
    subtypeLine: "Elf Druid",
    colors: ["Green"],
    power: "1",
    toughness: "1",
    rarity: "Common",
    set: "M20",
    abilities: [{ id: 1, text: "{T}: Add {G}." }],
    ...overrides,
  }
}

function makeGameObject(overrides: Partial<TGameObject> = {}): TGameObject {
  return {
    instanceId: 100,
    grpId: 1,
    type: "GameObjectType_Card",
    zoneId: 0,
    visibility: "Visibility_Public",
    ownerSeatId: 1,
    controllerSeatId: 1,
    cardTypes: [],
    subtypes: [],
    superTypes: [],
    color: [],
    abilities: [],
    name: 0,
    overlayGrpId: 0,
    power: { value: 1 },
    toughness: { value: 1 },
    isTapped: false,
    hasSummoningSickness: false,
    ...overrides,
  }
}

function makePlayerState(
  seatId: number,
  overrides: Partial<TPlayerState> = {},
): TPlayerState {
  return {
    systemSeatNumber: seatId,
    lifeTotal: 20,
    maxHandSize: 7,
    mulliganCount: 0,
    timerIds: [],
    ...overrides,
  }
}

function makeZone(overrides: Partial<TZoneState> = {}): TZoneState {
  return {
    zoneId: 0,
    type: "ZoneType_Battlefield",
    visibility: "Visibility_Public",
    objectInstanceIds: [],
    ...overrides,
  }
}

function makeTurnInfo(overrides: Partial<TTurnInfo> = {}): TTurnInfo {
  return {
    turnNumber: 1,
    phase: "Phase_Main1",
    activePlayer: 1,
    priorityPlayer: 1,
    ...overrides,
  }
}

let zoneIdCounter = 1
function nextZoneId() {
  return zoneIdCounter++
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameObjects: {},
    zones: {},
    players: {
      1: makePlayerState(1),
      2: makePlayerState(2),
    },
    turnInfo: makeTurnInfo(),
    stack: [],
    availableActions: [],
    pendingDecision: null,
    localPlayerSeatId: 1,
    gameStateId: 1,
    ...overrides,
  }
}

// ─── Card DB Stub ─────────────────────────────────────────────────────────────

function makeCardDb(cards: Record<number, ResolvedCard> = {}): ICardDbService {
  return {
    lookupCard: (grpId: number) => cards[grpId],
    isLoaded: () => true,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CoachingSnapshotTransform", () => {
  // ── buildSnapshot null guards ──────────────────────────────────────────────

  describe("buildSnapshot — null guards", () => {
    let transform: CoachingSnapshotTransform

    beforeEach(() => {
      transform = new CoachingSnapshotTransform(makeCardDb())
    })

    it("returns null if turnInfo is null and decision is not a mulligan type", () => {
      const state = makeGameState({
        turnInfo: null,
        pendingDecision: { type: "ActionsAvailable", actions: [] },
      })
      expect(transform.buildSnapshot(state)).toBeNull()
    })

    it("returns non-null if turnInfo is null but decision is Mulligan", () => {
      const state = makeGameState({
        turnInfo: null,
        pendingDecision: {
          type: "Mulligan",
          mulliganCount: 0,
          handInstanceIds: [],
        },
      })
      expect(transform.buildSnapshot(state)).not.toBeNull()
    })

    it("returns non-null if turnInfo is null but decision is LondonMulliganGroup", () => {
      const state = makeGameState({
        turnInfo: null,
        pendingDecision: {
          type: "LondonMulliganGroup",
          instanceIds: [],
          keepCount: 7,
        },
      })
      expect(transform.buildSnapshot(state)).not.toBeNull()
    })

    it("returns null if localPlayerSeatId is null", () => {
      const state = makeGameState({
        localPlayerSeatId: null,
        pendingDecision: { type: "ActionsAvailable", actions: [] },
      })
      expect(transform.buildSnapshot(state)).toBeNull()
    })

    it("returns null if pendingDecision is null", () => {
      const state = makeGameState({ pendingDecision: null })
      expect(transform.buildSnapshot(state)).toBeNull()
    })

    it("returns null if opponent seat cannot be found", () => {
      const state = makeGameState({
        players: { 1: makePlayerState(1) },
        pendingDecision: { type: "ActionsAvailable", actions: [] },
      })
      expect(transform.buildSnapshot(state)).toBeNull()
    })
  })

  // ── buildSnapshot zone population ──────────────────────────────────────────

  describe("buildSnapshot — zone population", () => {
    const card = makeResolvedCard({ grpId: 1, name: "Llanowar Elves" })
    const opponentCard = makeResolvedCard({
      grpId: 2,
      name: "Grizzly Bears",
      power: "2",
      toughness: "2",
    })
    let transform: CoachingSnapshotTransform

    beforeEach(() => {
      transform = new CoachingSnapshotTransform(
        makeCardDb({ 1: card, 2: opponentCard }),
      )
    })

    function stateWithZones(): GameState {
      const localObj = makeGameObject({
        instanceId: 101,
        grpId: 1,
        controllerSeatId: 1,
        ownerSeatId: 1,
      })
      const opponentObj = makeGameObject({
        instanceId: 201,
        grpId: 2,
        controllerSeatId: 2,
        ownerSeatId: 2,
      })

      const battlefieldId = nextZoneId()
      const localHandId = nextZoneId()
      const opponentHandId = nextZoneId()
      const localGraveyardId = nextZoneId()
      const oppGraveyardId = nextZoneId()
      const localExileId = nextZoneId()
      const oppExileId = nextZoneId()
      const localRevealedId = nextZoneId()
      const oppRevealedId = nextZoneId()

      return makeGameState({
        gameObjects: { 101: localObj, 201: opponentObj },
        zones: {
          [battlefieldId]: makeZone({
            zoneId: battlefieldId,
            type: "ZoneType_Battlefield",
            objectInstanceIds: [101, 201],
          }),
          [localHandId]: makeZone({
            zoneId: localHandId,
            type: "ZoneType_Hand",
            visibility: "Visibility_Private",
            ownerSeatId: 1,
            objectInstanceIds: [101],
          }),
          [opponentHandId]: makeZone({
            zoneId: opponentHandId,
            type: "ZoneType_Hand",
            visibility: "Visibility_Private",
            ownerSeatId: 2,
            objectInstanceIds: [201],
          }),
          [localGraveyardId]: makeZone({
            zoneId: localGraveyardId,
            type: "ZoneType_Graveyard",
            ownerSeatId: 1,
            objectInstanceIds: [101],
          }),
          [oppGraveyardId]: makeZone({
            zoneId: oppGraveyardId,
            type: "ZoneType_Graveyard",
            ownerSeatId: 2,
            objectInstanceIds: [201],
          }),
          [localExileId]: makeZone({
            zoneId: localExileId,
            type: "ZoneType_Exile",
            ownerSeatId: 1,
            objectInstanceIds: [101],
          }),
          [oppExileId]: makeZone({
            zoneId: oppExileId,
            type: "ZoneType_Exile",
            ownerSeatId: 2,
            objectInstanceIds: [201],
          }),
          [localRevealedId]: makeZone({
            zoneId: localRevealedId,
            type: "ZoneType_Revealed",
            ownerSeatId: 1,
            objectInstanceIds: [101],
          }),
          [oppRevealedId]: makeZone({
            zoneId: oppRevealedId,
            type: "ZoneType_Revealed",
            ownerSeatId: 2,
            objectInstanceIds: [201],
          }),
        },
        pendingDecision: { type: "ActionsAvailable", actions: [] },
      })
    }

    it("populates localPlayer battlefield with cards controlled by local player", () => {
      const snapshot = transform.buildSnapshot(stateWithZones())!
      expect(snapshot.localPlayer.battlefield).toHaveLength(1)
      expect(snapshot.localPlayer.battlefield[0].name).toBe("Llanowar Elves")
    })

    it("populates opponent battlefield with cards controlled by opponent", () => {
      const snapshot = transform.buildSnapshot(stateWithZones())!
      expect(snapshot.opponent.battlefield).toHaveLength(1)
      expect(snapshot.opponent.battlefield[0].name).toBe("Grizzly Bears")
    })

    it("populates localPlayer hand", () => {
      const snapshot = transform.buildSnapshot(stateWithZones())!
      expect(snapshot.localPlayer.hand).toHaveLength(1)
      expect(snapshot.localPlayer.hand[0].name).toBe("Llanowar Elves")
    })

    it("opponent hand is always []", () => {
      const snapshot = transform.buildSnapshot(stateWithZones())!
      expect(snapshot.opponent.hand).toEqual([])
    })

    it("opponent handSize matches getHandInstanceIds length", () => {
      const snapshot = transform.buildSnapshot(stateWithZones())!
      expect(snapshot.opponent.handSize).toBe(1)
    })

    it("localPlayer handSize matches hand array length", () => {
      const snapshot = transform.buildSnapshot(stateWithZones())!
      expect(snapshot.localPlayer.handSize).toBe(
        snapshot.localPlayer.hand.length,
      )
    })

    it("populates localPlayer graveyard", () => {
      const snapshot = transform.buildSnapshot(stateWithZones())!
      expect(snapshot.localPlayer.graveyard).toHaveLength(1)
      expect(snapshot.localPlayer.graveyard[0].name).toBe("Llanowar Elves")
    })

    it("populates opponent graveyard", () => {
      const snapshot = transform.buildSnapshot(stateWithZones())!
      expect(snapshot.opponent.graveyard).toHaveLength(1)
      expect(snapshot.opponent.graveyard[0].name).toBe("Grizzly Bears")
    })

    it("populates localPlayer exile", () => {
      const snapshot = transform.buildSnapshot(stateWithZones())!
      expect(snapshot.localPlayer.exile).toHaveLength(1)
    })

    it("populates opponent exile", () => {
      const snapshot = transform.buildSnapshot(stateWithZones())!
      expect(snapshot.opponent.exile).toHaveLength(1)
    })

    it("populates localPlayer revealed", () => {
      const snapshot = transform.buildSnapshot(stateWithZones())!
      expect(snapshot.localPlayer.revealed).toHaveLength(1)
    })

    it("populates opponent revealed", () => {
      const snapshot = transform.buildSnapshot(stateWithZones())!
      expect(snapshot.opponent.revealed).toHaveLength(1)
    })

    it("filters battlefield, hand, graveyard, exile, and revealed cards when objects or card lookups are missing", () => {
      const knownCard = makeResolvedCard({ grpId: 1, name: "Llanowar Elves" })
      const transform = new CoachingSnapshotTransform(makeCardDb({ 1: knownCard }))

      const battlefieldId = nextZoneId()
      const localHandId = nextZoneId()
      const opponentHandId = nextZoneId()
      const localGraveyardId = nextZoneId()
      const oppGraveyardId = nextZoneId()
      const localExileId = nextZoneId()
      const oppExileId = nextZoneId()
      const localRevealedId = nextZoneId()
      const oppRevealedId = nextZoneId()
      const localLibraryId = nextZoneId()
      const opponentLibraryId = nextZoneId()

      const state = makeGameState({
        gameObjects: {
          101: makeGameObject({
            instanceId: 101,
            grpId: 1,
            controllerSeatId: 1,
            ownerSeatId: 1,
          }),
          201: makeGameObject({
            instanceId: 201,
            grpId: 999,
            controllerSeatId: 2,
            ownerSeatId: 2,
          }),
        },
        zones: {
          [battlefieldId]: makeZone({
            zoneId: battlefieldId,
            type: "ZoneType_Battlefield",
            objectInstanceIds: [101, 201, 9999],
          }),
          [localHandId]: makeZone({
            zoneId: localHandId,
            type: "ZoneType_Hand",
            visibility: "Visibility_Private",
            ownerSeatId: 1,
            objectInstanceIds: [101, 9999],
          }),
          [opponentHandId]: makeZone({
            zoneId: opponentHandId,
            type: "ZoneType_Hand",
            visibility: "Visibility_Private",
            ownerSeatId: 2,
            objectInstanceIds: [201, 9999],
          }),
          [localGraveyardId]: makeZone({
            zoneId: localGraveyardId,
            type: "ZoneType_Graveyard",
            ownerSeatId: 1,
            objectInstanceIds: [101, 9999],
          }),
          [oppGraveyardId]: makeZone({
            zoneId: oppGraveyardId,
            type: "ZoneType_Graveyard",
            ownerSeatId: 2,
            objectInstanceIds: [201, 9999],
          }),
          [localExileId]: makeZone({
            zoneId: localExileId,
            type: "ZoneType_Exile",
            ownerSeatId: 1,
            objectInstanceIds: [101, 9999],
          }),
          [oppExileId]: makeZone({
            zoneId: oppExileId,
            type: "ZoneType_Exile",
            ownerSeatId: 2,
            objectInstanceIds: [201, 9999],
          }),
          [localRevealedId]: makeZone({
            zoneId: localRevealedId,
            type: "ZoneType_Revealed",
            ownerSeatId: 1,
            objectInstanceIds: [101, 9999],
          }),
          [oppRevealedId]: makeZone({
            zoneId: oppRevealedId,
            type: "ZoneType_Revealed",
            ownerSeatId: 2,
            objectInstanceIds: [201, 9999],
          }),
          [localLibraryId]: makeZone({
            zoneId: localLibraryId,
            type: "ZoneType_Library",
            ownerSeatId: 1,
            objectInstanceIds: [500, 501],
          }),
          [opponentLibraryId]: makeZone({
            zoneId: opponentLibraryId,
            type: "ZoneType_Library",
            ownerSeatId: 2,
            objectInstanceIds: [600],
          }),
        },
        pendingDecision: { type: "ActionsAvailable", actions: [] },
      })

      const snapshot = transform.buildSnapshot(state)!
      expect(snapshot.localPlayer.battlefield).toHaveLength(1)
      expect(snapshot.opponent.battlefield).toEqual([])
      expect(snapshot.localPlayer.hand).toHaveLength(1)
      expect(snapshot.localPlayer.graveyard).toHaveLength(1)
      expect(snapshot.localPlayer.exile).toHaveLength(1)
      expect(snapshot.localPlayer.revealed).toHaveLength(1)
      expect(snapshot.opponent.graveyard).toEqual([])
      expect(snapshot.opponent.exile).toEqual([])
      expect(snapshot.opponent.revealed).toEqual([])
      expect(snapshot.opponent.handSize).toBe(2)
      expect(snapshot.localPlayer.librarySize).toBe(2)
      expect(snapshot.opponent.librarySize).toBe(1)
    })

    it("uses seatId fallback when systemSeatNumber is absent", () => {
      const transform = new CoachingSnapshotTransform(makeCardDb({ 1: card }))
      const battlefieldId = nextZoneId()

      const state = makeGameState({
        players: {
          1: makePlayerState(1, { systemSeatNumber: undefined, seatId: 1 }),
          2: makePlayerState(2, {
            systemSeatNumber: undefined,
            seatId: 2,
            lifeTotal: 17,
          }),
        },
        gameObjects: {
          101: makeGameObject({
            instanceId: 101,
            grpId: 1,
            controllerSeatId: 1,
            ownerSeatId: 1,
          }),
        },
        zones: {
          [battlefieldId]: makeZone({
            zoneId: battlefieldId,
            type: "ZoneType_Battlefield",
            objectInstanceIds: [101],
          }),
        },
        pendingDecision: { type: "ActionsAvailable", actions: [] },
      })

      const snapshot = transform.buildSnapshot(state)!
      expect(snapshot.opponent.lifeTotal).toBe(17)
    })

    it("defaults life totals, turn metadata, and player zones when turnInfo and players are partial", () => {
      const transform = new CoachingSnapshotTransform(makeCardDb())
      const state = makeGameState({
        turnInfo: null,
        players: {
          1: makePlayerState(1, { lifeTotal: undefined as never }),
          2: makePlayerState(2, { lifeTotal: undefined as never }),
        },
        pendingDecision: {
          type: "Mulligan",
          mulliganCount: 0,
          handInstanceIds: [],
        },
      })

      const snapshot = transform.buildSnapshot(state)!
      expect(snapshot.turnNumber).toBe(0)
      expect(snapshot.phase).toBe("Phase_Beginning")
      expect(snapshot.step).toBeNull()
      expect(snapshot.isLocalPlayerTurn).toBe(false)
      expect(snapshot.localPlayer.lifeTotal).toBe(20)
      expect(snapshot.opponent.lifeTotal).toBe(20)
      expect(snapshot.localPlayer.librarySize).toBe(0)
      expect(snapshot.opponent.librarySize).toBe(0)
    })

    it("filters local hand cards when the game object exists but the card lookup is missing", () => {
      const transform = new CoachingSnapshotTransform(makeCardDb({ 1: card }))
      const localHandId = nextZoneId()

      const state = makeGameState({
        gameObjects: {
          101: makeGameObject({
            instanceId: 101,
            grpId: 999,
            ownerSeatId: 1,
            controllerSeatId: 1,
          }),
        },
        zones: {
          [localHandId]: makeZone({
            zoneId: localHandId,
            type: "ZoneType_Hand",
            visibility: "Visibility_Private",
            ownerSeatId: 1,
            objectInstanceIds: [101],
          }),
        },
        pendingDecision: { type: "ActionsAvailable", actions: [] },
      })

      const snapshot = transform.buildSnapshot(state)!
      expect(snapshot.localPlayer.hand).toEqual([])
      expect(snapshot.localPlayer.handSize).toBe(0)
    })
  })

  // ── buildSnapshot stack ────────────────────────────────────────────────────

  describe("buildSnapshot — stack", () => {
    it("resolves stack entries using objectSourceGrpId for abilities", () => {
      const sourceCard = makeResolvedCard({ grpId: 1, name: "Llanowar Elves" })
      const transform = new CoachingSnapshotTransform(
        makeCardDb({ 1: sourceCard }),
      )

      const abilityObj = makeGameObject({
        instanceId: 300,
        grpId: 999, // own grpId — should NOT be used for lookup
        type: "GameObjectType_Ability",
        objectSourceGrpId: 1,
        controllerSeatId: 1,
      })

      const stackZoneId = nextZoneId()
      const state = makeGameState({
        gameObjects: { 300: abilityObj },
        zones: {
          [stackZoneId]: makeZone({
            zoneId: stackZoneId,
            type: "ZoneType_Stack",
            objectInstanceIds: [300],
          }),
        },
        stack: [300],
        pendingDecision: { type: "ActionsAvailable", actions: [] },
      })

      const snapshot = transform.buildSnapshot(state)!
      expect(snapshot.stack).toHaveLength(1)
      expect(snapshot.stack[0].name).toBe("Llanowar Elves")
    })

    it("filters stack entries when the object or card lookup is missing and falls back to grpId for non-ability objects", () => {
      const sourceCard = makeResolvedCard({ grpId: 2, name: "Grizzly Bears" })
      const transform = new CoachingSnapshotTransform(makeCardDb({ 2: sourceCard }))

      const stackZoneId = nextZoneId()
      const state = makeGameState({
        gameObjects: {
          301: makeGameObject({
            instanceId: 301,
            grpId: 2,
            controllerSeatId: 2,
          }),
          302: makeGameObject({
            instanceId: 302,
            grpId: 999,
            controllerSeatId: 2,
          }),
        },
        zones: {
          [stackZoneId]: makeZone({
            zoneId: stackZoneId,
            type: "ZoneType_Stack",
            objectInstanceIds: [301, 302, 9999],
          }),
        },
        stack: [301, 302, 9999],
        pendingDecision: { type: "ActionsAvailable", actions: [] },
      })

      const snapshot = transform.buildSnapshot(state)!
      expect(snapshot.stack).toHaveLength(1)
      expect(snapshot.stack[0]).toMatchObject({
        name: "Grizzly Bears",
        controlledByLocalPlayer: false,
      })
    })

    it("treats a null stack as an empty stack", () => {
      const transform = new CoachingSnapshotTransform(makeCardDb())
      const state = makeGameState({
        stack: null as unknown as number[],
        pendingDecision: { type: "ActionsAvailable", actions: [] },
      })

      const snapshot = transform.buildSnapshot(state)!
      expect(snapshot.stack).toEqual([])
    })
  })

  // ── buildSnapshot turn info ────────────────────────────────────────────────

  describe("buildSnapshot — turn info", () => {
    it("isLocalPlayerTurn is true when activePlayer === localSeatId", () => {
      const transform = new CoachingSnapshotTransform(makeCardDb())
      const state = makeGameState({
        turnInfo: makeTurnInfo({ activePlayer: 1 }),
        pendingDecision: { type: "ActionsAvailable", actions: [] },
      })
      expect(transform.buildSnapshot(state)!.isLocalPlayerTurn).toBe(true)
    })

    it("isLocalPlayerTurn is false when activePlayer !== localSeatId", () => {
      const transform = new CoachingSnapshotTransform(makeCardDb())
      const state = makeGameState({
        turnInfo: makeTurnInfo({ activePlayer: 2 }),
        pendingDecision: { type: "ActionsAvailable", actions: [] },
      })
      expect(transform.buildSnapshot(state)!.isLocalPlayerTurn).toBe(false)
    })
  })

  // ── buildDecision ──────────────────────────────────────────────────────────

  describe("buildDecision", () => {
    const card = makeResolvedCard({
      grpId: 1,
      name: "Llanowar Elves",
      manaCost: "{G}",
    })
    const card2 = makeResolvedCard({
      grpId: 2,
      name: "Grizzly Bears",
      power: "2",
      toughness: "2",
    })
    let transform: CoachingSnapshotTransform

    beforeEach(() => {
      transform = new CoachingSnapshotTransform(
        makeCardDb({ 1: card, 2: card2 }),
      )

      vi.mocked(greFormatting.formatManaCost).mockReturnValue("{G}")
      vi.mocked(greFormatting.getManaColorString).mockReturnValue("{G}")
    })

    function stateWithDecision(
      decision: PendingDecision,
      extraObjects: Record<number, TGameObject> = {},
    ): GameState {
      return makeGameState({
        gameObjects: {
          101: makeGameObject({
            instanceId: 101,
            grpId: 1,
            controllerSeatId: 1,
          }),
          201: makeGameObject({
            instanceId: 201,
            grpId: 2,
            controllerSeatId: 2,
          }),
          ...extraObjects,
        },
        pendingDecision: decision,
      })
    }

    // ── ActionsAvailable ──

    it("ActionsAvailable — maps cast actions to strings", () => {
      const manaCost: TManaCost[] = [{ color: ["ManaColor_Green"], count: 1 }]
      const state = stateWithDecision({
        type: "ActionsAvailable",
        actions: [
          {
            actionType: "ActionType_Cast",
            instanceId: 101,
            grpId: 1,
            manaCost,
          },
        ],
      })
      const decision = transform.buildSnapshot(state)!.decision
      expect(decision.type).toBe("ActionsAvailable")
      if (decision.type !== "ActionsAvailable") return

      expect(greFormatting.formatManaCost).toHaveBeenCalledWith(manaCost)
      expect(
        decision.actions.some(
          (a) =>
            a.includes("Cast") &&
            a.includes("Llanowar Elves") &&
            a.includes("{G}"),
        ),
      ).toBe(true)
    })

    it("ActionsAvailable — maps play land action to string", () => {
      const state = stateWithDecision({
        type: "ActionsAvailable",
        actions: [{ actionType: "ActionType_Play", instanceId: 101, grpId: 1 }],
      })
      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "ActionsAvailable") return
      expect(
        decision.actions.some(
          (a) => a.includes("Play land") && a.includes("Llanowar Elves"),
        ),
      ).toBe(true)
    })

    it("ActionsAvailable — collapses mana actions by grpId", () => {
      const state = stateWithDecision({
        type: "ActionsAvailable",
        actions: [
          {
            actionType: "ActionType_Activate_Mana",
            instanceId: 101,
            grpId: 1,
            manaSelections: [],
          },
          {
            actionType: "ActionType_Activate_Mana",
            instanceId: 102,
            grpId: 1,
            manaSelections: [],
          },
        ],
      })
      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "ActionsAvailable") return
      const manaActions = decision.actions.filter((a) => a.includes("mana"))
      expect(manaActions).toHaveLength(1)
      expect(manaActions[0]).toMatch(/2 available/)
    })

    it("ActionsAvailable — excludes FloatMana actions", () => {
      const state = stateWithDecision({
        type: "ActionsAvailable",
        actions: [
          { actionType: "ActionType_FloatMana", instanceId: 101, grpId: 1 },
          { actionType: "ActionType_Pass" },
        ],
      })
      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "ActionsAvailable") return
      expect(decision.actions.every((a) => !a.includes("FloatMana"))).toBe(true)
    })

    it("ActionsAvailable — includes Pass priority", () => {
      const state = stateWithDecision({
        type: "ActionsAvailable",
        actions: [{ actionType: "ActionType_Pass" }],
      })
      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "ActionsAvailable") return
      expect(decision.actions).toContain("Pass priority")
    })

    it("ActionsAvailable — maps activate ability action to string", () => {
      const state = stateWithDecision({
        type: "ActionsAvailable",
        actions: [
          { actionType: "ActionType_Activate", instanceId: 101, grpId: 1 },
        ],
      })
      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "ActionsAvailable") return
      expect(
        decision.actions.some(
          (a) => a.includes("Activate ability") && a.includes("Llanowar Elves"),
        ),
      ).toBe(true)
    })

    it("ActionsAvailable — falls back to actionType string for unrecognized action types", () => {
      const state = makeGameState({
        gameObjects: {},
        pendingDecision: {
          type: "ActionsAvailable",
          actions: [{ actionType: "ActionType_Unknown_XYZ" as any }] as any,
        },
      })
      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "ActionsAvailable") return
      expect(decision.actions).toContain("ActionType_Unknown_XYZ")
    })

    it("ActionsAvailable — falls back for unknown cards, missing instanceIds, and single mana action strings", () => {
      vi.mocked(greFormatting.getManaColorString).mockReturnValue("{U}")

      const state = makeGameState({
        gameObjects: {
          101: makeGameObject({
            instanceId: 101,
            grpId: 999,
          }),
        },
        pendingDecision: {
          type: "ActionsAvailable",
          actions: [
            { actionType: "ActionType_Play", instanceId: 101, grpId: 999 },
            { actionType: "ActionType_Activate", instanceId: 555, grpId: 999 },
            { actionType: "ActionType_Activate_Mana", manaSelections: [] },
          ],
        },
      })

      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "ActionsAvailable") return
      expect(decision.actions).toContain("Play land: Unknown (instance 101)")
      expect(decision.actions).toContain("Activate ability: Unknown (instance 555)")
      expect(
        decision.actions.some(
          (action) =>
            action.includes("Tap Unknown (grpId -1) for mana") &&
            action.includes("{U}"),
        ),
      ).toBe(true)
    })

    it("ActionsAvailable — formats cast actions with an empty mana cost when manaCost is omitted", () => {
      vi.mocked(greFormatting.formatManaCost).mockReturnValue("")

      const state = stateWithDecision({
        type: "ActionsAvailable",
        actions: [{ actionType: "ActionType_Cast", instanceId: 101, grpId: 1 }],
      })

      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "ActionsAvailable") return
      expect(greFormatting.formatManaCost).toHaveBeenCalledWith([])
      expect(decision.actions).toContain("Cast Llanowar Elves ")
    })

    // ── DeclareAttackers ──

    it("DeclareAttackers — maps eligible attackers with name, power, toughness", () => {
      const state = stateWithDecision({
        type: "DeclareAttackers",
        eligibleAttackers: [{ attackerInstanceId: 101 }],
      })
      const decision = transform.buildSnapshot(state)!.decision
      expect(decision.type).toBe("DeclareAttackers")
      if (decision.type !== "DeclareAttackers") return
      expect(decision.eligibleAttackers).toHaveLength(1)
      expect(decision.eligibleAttackers[0]).toMatchObject({
        instanceId: 101,
        name: "Llanowar Elves",
        power: "1",
        toughness: "1",
      })
    })

    it("DeclareAttackers — prefers live power/toughness from game object over card DB", () => {
      const state = stateWithDecision(
        {
          type: "DeclareAttackers",
          eligibleAttackers: [{ attackerInstanceId: 101 }],
        },
        {
          101: makeGameObject({
            instanceId: 101,
            grpId: 1,
            power: { value: 3 },
            toughness: { value: 3 },
          }),
        },
      )
      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "DeclareAttackers") return
      expect(decision.eligibleAttackers[0].power).toBe("3")
      expect(decision.eligibleAttackers[0].toughness).toBe("3")
    })

    it("DeclareAttackers — falls back to unknown name, '?' stats, and untapped=false default", () => {
      const state = makeGameState({
        gameObjects: {},
        pendingDecision: {
          type: "DeclareAttackers",
          eligibleAttackers: [{ attackerInstanceId: 404 }],
        },
      })

      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "DeclareAttackers") return
      expect(decision.eligibleAttackers[0]).toMatchObject({
        instanceId: 404,
        name: "Unknown (instance 404)",
        power: "?",
        toughness: "?",
        isTapped: false,
      })
    })

    // ── DeclareBlockers ──

    it("DeclareBlockers — maps blockers with nested attacker list", () => {
      const state = stateWithDecision({
        type: "DeclareBlockers",
        eligibleBlockers: [
          { blockerInstanceId: 101, attackerInstanceIds: [201] },
        ],
      })
      const decision = transform.buildSnapshot(state)!.decision
      expect(decision.type).toBe("DeclareBlockers")
      if (decision.type !== "DeclareBlockers") return
      expect(decision.eligibleBlockers).toHaveLength(1)
      expect(decision.eligibleBlockers[0].name).toBe("Llanowar Elves")
      expect(decision.eligibleBlockers[0].attackers).toHaveLength(1)
      expect(decision.eligibleBlockers[0].attackers[0].name).toBe(
        "Grizzly Bears",
      )
    })

    it("DeclareBlockers — falls back for unknown blocker and attacker objects", () => {
      const state = makeGameState({
        gameObjects: {},
        pendingDecision: {
          type: "DeclareBlockers",
          eligibleBlockers: [
            { blockerInstanceId: 404, attackerInstanceIds: [405] },
          ],
        },
      })

      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "DeclareBlockers") return
      expect(decision.eligibleBlockers[0]).toMatchObject({
        instanceId: 404,
        name: "Unknown (instance 404)",
        power: "?",
        toughness: "?",
      })
      expect(decision.eligibleBlockers[0].attackers[0]).toMatchObject({
        instanceId: 405,
        name: "Unknown (instance 405)",
        power: "?",
        toughness: "?",
      })
    })

    // ── SelectTargets ──

    it("SelectTargets — maps source name and target slots with options", () => {
      const sourceObj = makeGameObject({ instanceId: 300, grpId: 1 })
      const targetObj = makeGameObject({ instanceId: 201, grpId: 2 })
      const state = makeGameState({
        gameObjects: { 300: sourceObj, 201: targetObj },
        pendingDecision: {
          type: "SelectTargets",
          sourceId: 300,
          abilityGrpId: undefined,
          targetSlots: [
            {
              targetIdx: 0,
              minTargets: 1,
              maxTargets: 1,
              targets: [{ targetInstanceId: 201 }],
            },
          ],
        },
      })
      const decision = transform.buildSnapshot(state)!.decision
      expect(decision.type).toBe("SelectTargets")
      if (decision.type !== "SelectTargets") return
      expect(decision.sourceName).toBe("Llanowar Elves")
      expect(decision.targetSlots).toHaveLength(1)
      expect(decision.targetSlots[0].options[0].name).toBe("Grizzly Bears")
    })

    it("SelectTargets — uses default min/max and unknown source or target fallbacks", () => {
      const state = makeGameState({
        gameObjects: {},
        pendingDecision: {
          type: "SelectTargets",
          sourceId: undefined,
          abilityGrpId: undefined,
          targetSlots: [
            {
              targetIdx: 0,
              targets: [{ targetInstanceId: undefined }],
            },
            {
              targetIdx: 1,
            },
          ],
        },
      })

      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "SelectTargets") return
      expect(decision.sourceName).toBe("Unknown (grpId undefined)")
      expect(decision.targetSlots[0]).toMatchObject({
        minTargets: 1,
        maxTargets: 1,
      })
      expect(decision.targetSlots[0].options[0]).toMatchObject({
        instanceId: -1,
        name: "Unknown (instance undefined)",
      })
      expect(decision.targetSlots[1].options).toEqual([])
    })

    // ── PayCosts ──

    it("PayCosts — formats mana cost and maps payment option names", () => {
      const manaCost: TManaCost[] = [{ color: ["ManaColor_Green"], count: 1 }]
      const state = stateWithDecision({
        type: "PayCosts",
        manaCost,
        paymentActions: [
          { actionType: "ActionType_Activate_Mana", instanceId: 101, grpId: 1 },
        ],
      })
      const decision = transform.buildSnapshot(state)!.decision
      expect(decision.type).toBe("PayCosts")
      if (decision.type !== "PayCosts") return

      expect(greFormatting.formatManaCost).toHaveBeenCalledWith(manaCost)
      expect(decision.cost).toBe("{G}")
      expect(decision.paymentOptions).toContain("Llanowar Elves")
    })

    it("PayCosts — falls back to unknown payment option names", () => {
      const state = makeGameState({
        gameObjects: {},
        pendingDecision: {
          type: "PayCosts",
          manaCost: [],
          paymentActions: [{ actionType: "ActionType_Activate_Mana" }],
        },
      })

      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "PayCosts") return
      expect(decision.paymentOptions).toEqual(["Unknown (instance undefined)"])
    })

    // ── AssignDamage ──

    it('AssignDamage — maps player seat IDs to "You" and "Opponent"', () => {
      const state = makeGameState({
        localPlayerSeatId: 1,
        gameObjects: {
          101: makeGameObject({
            instanceId: 101,
            grpId: 1,
            controllerSeatId: 2,
          }),
        },
        pendingDecision: {
          type: "AssignDamage",
          damageAssigners: [
            {
              instanceId: 101,
              totalDamage: 3,
              assignments: [
                { instanceId: 1, assignedDamage: 3 }, // local player seat
                { instanceId: 2, assignedDamage: 0 }, // opponent seat
              ],
            },
          ],
        },
      })
      const decision = transform.buildSnapshot(state)!.decision
      expect(decision.type).toBe("AssignDamage")
      if (decision.type !== "AssignDamage") return
      const targets = decision.damageAssigners[0].assignments.map(
        (a) => a.targetName,
      )
      expect(targets).toContain("You")
      expect(targets).toContain("Opponent")
    })

    it("AssignDamage — maps creature targets by name", () => {
      const state = makeGameState({
        localPlayerSeatId: 1,
        gameObjects: {
          101: makeGameObject({
            instanceId: 101,
            grpId: 1,
            controllerSeatId: 2,
          }),
          201: makeGameObject({
            instanceId: 201,
            grpId: 2,
            controllerSeatId: 1,
          }),
        },
        pendingDecision: {
          type: "AssignDamage",
          damageAssigners: [
            {
              instanceId: 101,
              totalDamage: 2,
              assignments: [{ instanceId: 201, assignedDamage: 2 }],
            },
          ],
        },
      })
      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "AssignDamage") return
      expect(decision.damageAssigners[0].assignments[0].targetName).toBe(
        "Grizzly Bears",
      )
    })

    it("AssignDamage — falls back for unknown attackers and creature targets, and defaults min/max damage", () => {
      const state = makeGameState({
        localPlayerSeatId: 2,
        gameObjects: {},
        pendingDecision: {
          type: "AssignDamage",
          damageAssigners: [
            {
              instanceId: 404,
              totalDamage: 4,
              assignments: [
                { instanceId: 1, assignedDamage: 1 },
                { instanceId: 999, assignedDamage: 3 },
              ],
            },
          ],
        },
      })

      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "AssignDamage") return
      expect(decision.damageAssigners[0].attackerName).toBe(
        "Unknown (instance 404)",
      )
      expect(decision.damageAssigners[0].assignments[0]).toMatchObject({
        targetName: "Opponent",
        minDamage: 0,
        maxDamage: 1,
      })
      expect(decision.damageAssigners[0].assignments[1]).toMatchObject({
        targetName: "Unknown (instance 999)",
        minDamage: 0,
        maxDamage: 3,
      })
    })

    // ── Mulligan ──

    it("Mulligan — resolves card names from hand instance IDs", () => {
      const state = makeGameState({
        turnInfo: null,
        gameObjects: { 101: makeGameObject({ instanceId: 101, grpId: 1 }) },
        pendingDecision: {
          type: "Mulligan",
          mulliganCount: 1,
          handInstanceIds: [101],
        },
      })
      const decision = transform.buildSnapshot(state)!.decision
      expect(decision.type).toBe("Mulligan")
      if (decision.type !== "Mulligan") return
      expect(decision.mulliganCount).toBe(1)
      expect(decision.cards).toContain("Llanowar Elves")
    })

    it("Mulligan — falls back to unknown card names", () => {
      const state = makeGameState({
        turnInfo: null,
        gameObjects: {},
        pendingDecision: {
          type: "Mulligan",
          mulliganCount: 2,
          handInstanceIds: [999],
        },
      })

      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "Mulligan") return
      expect(decision.cards).toEqual(["Unknown (instance 999)"])
    })

    // ── LondonMulliganGroup ──

    it("LondonMulliganGroup — resolves card names and keepCount", () => {
      const state = makeGameState({
        turnInfo: null,
        gameObjects: {
          101: makeGameObject({ instanceId: 101, grpId: 1 }),
          201: makeGameObject({ instanceId: 201, grpId: 2 }),
        },
        pendingDecision: {
          type: "LondonMulliganGroup",
          instanceIds: [101, 201],
          keepCount: 6,
        },
      })
      const decision = transform.buildSnapshot(state)!.decision
      expect(decision.type).toBe("LondonMulliganGroup")
      if (decision.type !== "LondonMulliganGroup") return
      expect(decision.keepCount).toBe(6)
      expect(decision.cards).toContain("Llanowar Elves")
      expect(decision.cards).toContain("Grizzly Bears")
    })

    it("LondonMulliganGroup — falls back to unknown card names", () => {
      const state = makeGameState({
        turnInfo: null,
        gameObjects: {},
        pendingDecision: {
          type: "LondonMulliganGroup",
          instanceIds: [999],
          keepCount: 5,
        },
      })

      const decision = transform.buildSnapshot(state)!.decision
      if (decision.type !== "LondonMulliganGroup") return
      expect(decision.cards).toEqual(["Unknown (instance 999)"])
    })
  })
})
