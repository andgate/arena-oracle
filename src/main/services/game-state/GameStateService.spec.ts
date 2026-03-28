import { GameState } from "@shared/game-state-types"
import { TGREMessage, TGreToClientEvent } from "@shared/gre/gre-types"
import { Subject, firstValueFrom } from "rxjs"
import { skip, take } from "rxjs/operators"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { IPlayerLogParserService } from "../player-log-parser/PlayerLogParserService.interface"
import { initialGameState } from "./GameStateReducer"
import {
  GameStateReducerEffect,
  IGameStateReducer,
} from "./GameStateReducer.interface"
import { GameStateService } from "./GameStateService"

function makeParserService(): IPlayerLogParserService & {
  subject: Subject<TGreToClientEvent>
} {
  const subject = new Subject<TGreToClientEvent>()
  return {
    events$: subject.asObservable(),
    subject,
  }
}

function makeEvent(messages: TGREMessage[]): TGreToClientEvent {
  return {
    transactionId: "tx-1",
    requestId: 1,
    timestamp: "2026-03-27T00:00:00.000Z",
    greToClientEvent: {
      greToClientMessages: messages,
    },
  }
}

function gameStateMsg(
  systemSeatIds: number[],
  gameStateId: number,
): Extract<TGREMessage, { type: "GREMessageType_GameStateMessage" }> {
  return {
    type: "GREMessageType_GameStateMessage",
    systemSeatIds,
    msgId: 1,
    gameStateId,
    gameStateMessage: {
      type: "GameStateType_Diff",
      gameStateId,
    },
  }
}

function actionsAvailableMsg(
  systemSeatIds: number[],
  gameStateId: number,
): Extract<TGREMessage, { type: "GREMessageType_ActionsAvailableReq" }> {
  return {
    type: "GREMessageType_ActionsAvailableReq",
    systemSeatIds,
    msgId: 1,
    gameStateId,
    actionsAvailableReq: {
      actions: [{ actionType: "ActionType_Pass" }],
    },
  }
}

function connectRespMsg(
  systemSeatIds: number[],
): Extract<TGREMessage, { type: "GREMessageType_ConnectResp" }> {
  return {
    type: "GREMessageType_ConnectResp",
    systemSeatIds,
    msgId: 1,
    gameStateId: 0,
  }
}

function makeReducerResult(
  state: GameState = initialGameState(),
  effects: GameStateReducerEffect[] = [],
  lastDecisionKey = "",
) {
  return {
    state,
    effects,
    lastDecisionKey,
  }
}

describe("GameStateService", () => {
  let parserService: ReturnType<typeof makeParserService>
  let reducer: IGameStateReducer
  let service: GameStateService

  beforeEach(() => {
    parserService = makeParserService()
    reducer = {
      reduceMessage: () => makeReducerResult(),
    }
    service = new GameStateService(parserService, reducer)
  })

  afterEach(() => {
    service.stop()
  })

  it("emits on stateUpdated$ when the reducer publishes a stateUpdated effect", async () => {
    const nextStateValue = {
      ...initialGameState(),
      gameStateId: 1,
    }
    reducer.reduceMessage = () =>
      makeReducerResult(nextStateValue, [
        {
          type: "stateUpdated",
          state: nextStateValue,
        },
      ])
    const nextState = firstValueFrom(
      service.stateUpdated$.pipe(skip(1), take(1)),
    )

    parserService.subject.next(makeEvent([gameStateMsg([1], 1)]))

    await expect(nextState).resolves.toMatchObject({
      gameStateId: 1,
    })
  })

  it("emits on decisionRequired$ when the reducer publishes a decision effect", async () => {
    const decisionState = {
      ...initialGameState(),
      pendingDecision: {
        type: "ActionsAvailable" as const,
        actions: [{ actionType: "ActionType_Pass" as const }],
      },
      availableActions: [{ actionType: "ActionType_Pass" as const }],
    }
    reducer.reduceMessage = () =>
      makeReducerResult(decisionState, [
        {
          type: "decisionRequired",
          state: decisionState,
        },
      ])
    const nextDecision = firstValueFrom(
      service.decisionRequired$.pipe(skip(1), take(1)),
    )

    parserService.subject.next(makeEvent([actionsAvailableMsg([1], 2)]))

    await expect(nextDecision).resolves.toMatchObject({
      pendingDecision: {
        type: "ActionsAvailable",
      },
      availableActions: [{ actionType: "ActionType_Pass" }],
    })
  })

  it("fires gameReset$ when the reducer publishes a reset effect", async () => {
    reducer.reduceMessage = () =>
      makeReducerResult(initialGameState(), [{ type: "gameReset" }])
    const reset = firstValueFrom(service.gameReset$.pipe(take(1)))

    parserService.subject.next(makeEvent([connectRespMsg([1])]))

    await expect(reset).resolves.toBeUndefined()
  })

  it("populates localPlayerSeatId from the first message received before reducing", async () => {
    reducer.reduceMessage = (currentState) =>
      makeReducerResult(
        {
          ...currentState,
          gameStateId: 1,
        },
        [
          {
            type: "stateUpdated",
            state: {
              ...currentState,
              gameStateId: 1,
            },
          },
        ],
      )
    const nextState = firstValueFrom(
      service.stateUpdated$.pipe(skip(1), take(1)),
    )

    parserService.subject.next(makeEvent([gameStateMsg([7], 1)]))

    await expect(nextState).resolves.toMatchObject({
      localPlayerSeatId: 7,
      gameStateId: 1,
    })
  })

  it("does not populate localPlayerSeatId from an empty systemSeatIds array", async () => {
    reducer.reduceMessage = (currentState, lastDecisionKey, msg) =>
      makeReducerResult(
        {
          ...currentState,
          gameStateId: msg.gameStateId,
        },
        [
          {
            type: "stateUpdated",
            state: {
              ...currentState,
              gameStateId: msg.gameStateId,
            },
          },
        ],
        lastDecisionKey,
      )
    const nextState = firstValueFrom(
      service.stateUpdated$.pipe(skip(1), take(1)),
    )

    parserService.subject.next(
      makeEvent([gameStateMsg([], 1), gameStateMsg([9], 2)]),
    )

    await expect(nextState).resolves.toMatchObject({
      localPlayerSeatId: null,
      gameStateId: 1,
    })
  })

  it("passes parser messages to the reducer in order", () => {
    const seen: TGREMessage[] = []
    reducer.reduceMessage = (currentState, lastDecisionKey, msg) => {
      seen.push(msg)
      return makeReducerResult(currentState, [], lastDecisionKey)
    }

    const first = gameStateMsg([1], 1)
    const second = actionsAvailableMsg([1], 2)

    parserService.subject.next(makeEvent([first, second]))

    expect(seen).toEqual([first, second])
  })
})
