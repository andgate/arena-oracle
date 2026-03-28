import { GameState } from "@shared/game-state-types"
import { TGREMessage } from "@shared/gre/gre-types"

export const IGameStateReducer = Symbol("IGameStateReducer")

export type GameStateReducerEffect =
  | { type: "stateUpdated"; state: GameState }
  | { type: "decisionRequired"; state: GameState }
  | { type: "gameReset" }

export interface GameStateReducerResult {
  state: GameState
  lastDecisionKey: string
  effects: GameStateReducerEffect[]
}

export interface IGameStateReducer {
  reduceMessage(
    state: GameState,
    lastDecisionKey: string,
    msg: TGREMessage,
  ): GameStateReducerResult
}
