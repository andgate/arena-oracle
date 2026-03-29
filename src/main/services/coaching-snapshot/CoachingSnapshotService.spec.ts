import { CoachingSnapshotService } from "@main/services/coaching-snapshot/CoachingSnapshotService"
import type { ICoachingSnapshotTransform } from "@main/services/coaching-snapshot/CoachingSnapshotTransform.interface"
import type { IGameStateService } from "@main/services/game-state/GameStateService.interface"
import type { CoachingSnapshot } from "@shared/coaching-types"
import type { GameState } from "@shared/game-state-types"
import { BehaviorSubject, Subject } from "rxjs"
import { describe, expect, it, vi } from "vitest"

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameObjects: {},
    zones: {},
    players: {},
    turnInfo: null,
    stack: [],
    availableActions: [],
    pendingDecision: null,
    localPlayerSeatId: null,
    gameStateId: 0,
    ...overrides,
  }
}

const STUB_SNAPSHOT: CoachingSnapshot = {
  turnNumber: 1,
  phase: "Phase_Main1",
  step: null,
  isLocalPlayerTurn: true,
  localPlayer: {
    lifeTotal: 20,
    isLocalPlayer: true,
    battlefield: [],
    hand: [],
    handSize: 0,
    revealed: [],
    librarySize: 60,
    graveyard: [],
    graveyardSize: 0,
    exile: [],
    exileSize: 0,
  },
  opponent: {
    lifeTotal: 20,
    isLocalPlayer: false,
    battlefield: [],
    hand: [],
    handSize: 0,
    revealed: [],
    librarySize: 60,
    graveyard: [],
    graveyardSize: 0,
    exile: [],
    exileSize: 0,
  },
  stack: [],
  decision: { type: "ActionsAvailable", actions: [] },
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeFixtures() {
  const stateUpdated$ = new BehaviorSubject<GameState>(makeGameState())
  const decisionRequired$ = new Subject<GameState>()
  const gameReset$ = new Subject<void>()

  const gameStateService: IGameStateService = {
    stateUpdated$,
    decisionRequired$,
    gameReset$,
  }

  const transform: ICoachingSnapshotTransform = {
    buildSnapshot: vi.fn().mockReturnValue(STUB_SNAPSHOT),
  }

  const service = new CoachingSnapshotService(gameStateService, transform)

  return { service, gameStateService, decisionRequired$, gameReset$, transform }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CoachingSnapshotService", () => {
  describe("decisionRequired$", () => {
    it("calls transform.buildSnapshot and emits the result on snapshot$", () => {
      const { service, decisionRequired$, transform } = makeFixtures()
      const emitted: (CoachingSnapshot | null)[] = []
      service.snapshot$.subscribe((s) => emitted.push(s))

      const state = makeGameState()
      decisionRequired$.next(state)

      expect(transform.buildSnapshot).toHaveBeenCalledWith(state)
      expect(emitted).toEqual([null, STUB_SNAPSHOT])
    })

    it("emits null when transform.buildSnapshot returns null", () => {
      const { service, decisionRequired$, transform } = makeFixtures()
      vi.mocked(transform.buildSnapshot).mockReturnValue(null)

      const emitted: (CoachingSnapshot | null)[] = []
      service.snapshot$.subscribe((s) => emitted.push(s))

      decisionRequired$.next(makeGameState())

      expect(emitted).toEqual([null, null])
    })

    it("emits once per decisionRequired$ emission", () => {
      const { service, decisionRequired$ } = makeFixtures()
      const emitted: (CoachingSnapshot | null)[] = []
      service.snapshot$.subscribe((s) => emitted.push(s))

      decisionRequired$.next(makeGameState())
      decisionRequired$.next(makeGameState())
      decisionRequired$.next(makeGameState())

      // initial null + 3 emissions
      expect(emitted).toHaveLength(4)
    })
  })

  describe("gameReset$", () => {
    it("sets snapshot$ to null on gameReset$ emission", () => {
      const { service, decisionRequired$, gameReset$ } = makeFixtures()
      const emitted: (CoachingSnapshot | null)[] = []
      service.snapshot$.subscribe((s) => emitted.push(s))

      decisionRequired$.next(makeGameState()) // snapshot becomes STUB_SNAPSHOT
      gameReset$.next() // snapshot should return to null

      expect(emitted).toEqual([null, STUB_SNAPSHOT, null])
    })
  })

  describe("stop()", () => {
    it("unsubscribes from decisionRequired$ — no further emissions on snapshot$", () => {
      const { service, decisionRequired$ } = makeFixtures()
      const emitted: (CoachingSnapshot | null)[] = []
      service.snapshot$.subscribe((s) => emitted.push(s))

      service.stop()
      decisionRequired$.next(makeGameState())

      expect(emitted).toEqual([null]) // only the initial BehaviorSubject value
    })

    it("unsubscribes from gameReset$ — no further null emissions on snapshot$", () => {
      const { service, decisionRequired$, gameReset$ } = makeFixtures()
      const emitted: (CoachingSnapshot | null)[] = []
      service.snapshot$.subscribe((s) => emitted.push(s))

      decisionRequired$.next(makeGameState()) // emit a snapshot first
      service.stop()
      gameReset$.next() // should be ignored

      expect(emitted).toEqual([null, STUB_SNAPSHOT]) // no trailing null
    })

    it("is safe to call stop() multiple times", () => {
      const { service } = makeFixtures()
      expect(() => {
        service.stop()
        service.stop()
      }).not.toThrow()
    })
  })
})
