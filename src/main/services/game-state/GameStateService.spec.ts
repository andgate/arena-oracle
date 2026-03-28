import { TGREMessage, TGreToClientEvent } from "@shared/gre/gre-types"
import { Subject, firstValueFrom } from "rxjs"
import { skip, take } from "rxjs/operators"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { IPlayerLogParserService } from "../player-log-parser/PlayerLogParserService.interface"
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

describe("GameStateService", () => {
  let parserService: ReturnType<typeof makeParserService>
  let service: GameStateService

  beforeEach(() => {
    parserService = makeParserService()
    service = new GameStateService(parserService)
  })

  afterEach(() => {
    service.stop()
  })

  it("emits on stateUpdated$ after a valid GameStateMessage event", async () => {
    const nextState = firstValueFrom(
      service.stateUpdated$.pipe(skip(1), take(1)),
    )

    parserService.subject.next(makeEvent([gameStateMsg([1], 1)]))

    await expect(nextState).resolves.toMatchObject({
      gameStateId: 1,
    })
  })

  it("emits on decisionRequired$ after a valid decision message event", async () => {
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

  it("fires gameReset$ on ConnectResp", async () => {
    const reset = firstValueFrom(service.gameReset$.pipe(take(1)))

    parserService.subject.next(makeEvent([connectRespMsg([1])]))

    await expect(reset).resolves.toBeUndefined()
  })

  it("populates localPlayerSeatId from the first message received", async () => {
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
})
