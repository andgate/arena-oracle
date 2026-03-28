import type { TGREMessage } from "@shared/gre/gre-types"
import { BehaviorSubject, Subject, Subscription } from "rxjs"
import { inject, injectable, singleton } from "tsyringe"
import { IStoppable } from "../lifecycle"
import { IPlayerLogParserService } from "../player-log-parser/PlayerLogParserService.interface"
import { initialGameState } from "./GameStateReducer"
import type { IGameStateReducer } from "./GameStateReducer.interface"
import { IGameStateReducer as IGameStateReducerToken } from "./GameStateReducer.interface"
import { IGameStateService } from "./GameStateService.interface"

@injectable()
@singleton()
export class GameStateService implements IGameStateService, IStoppable {
  readonly stateUpdated$ = new BehaviorSubject(initialGameState())
  readonly decisionRequired$ = new BehaviorSubject(initialGameState())
  readonly gameReset$ = new Subject<void>()

  private gameState = initialGameState()
  // Deduplication — don't fire decisionRequired for the same
  // gameStateId + decision type more than once
  private lastDecisionKey = ""

  private unsubParser: Subscription | null = null

  constructor(
    @inject(IPlayerLogParserService) parserService: IPlayerLogParserService,
    @inject(IGameStateReducerToken) private reducer: IGameStateReducer,
  ) {
    this.unsubParser = parserService.events$.subscribe((event) => {
      for (const msg of event.greToClientEvent
        .greToClientMessages as TGREMessage[]) {
        // Always try to grab localPlayerSeatId from any message
        if (
          this.gameState.localPlayerSeatId === null &&
          msg.systemSeatIds.length > 0
        ) {
          this.gameState = {
            ...this.gameState,
            localPlayerSeatId: msg.systemSeatIds[0],
          }
        }

        const result = this.reducer.reduceMessage(
          this.gameState,
          this.lastDecisionKey,
          msg,
        )
        this.gameState = result.state
        this.lastDecisionKey = result.lastDecisionKey

        this.publishEffects(result.effects)
      }
    })
  }

  stop() {
    this.unsubParser?.unsubscribe()
    this.unsubParser = null
  }

  // ============================================================
  // Effect publisher — wires ReducerResult effects to RxJS subjects
  // ============================================================

  private publishEffects(
    effects: ReturnType<IGameStateReducer["reduceMessage"]>["effects"],
  ) {
    for (const effect of effects) {
      switch (effect.type) {
        case "stateUpdated":
          this.stateUpdated$.next(effect.state)
          break
        case "decisionRequired":
          this.decisionRequired$.next(effect.state)
          break
        case "gameReset":
          this.gameReset$.next(undefined)
          break
      }
    }
  }
}
