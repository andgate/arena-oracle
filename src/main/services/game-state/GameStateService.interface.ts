import { GameState } from "@shared/game-state-types"
import { Observable } from "rxjs"

export const IGameStateService = Symbol("IGameStateService")

export interface IGameStateService {
  stateUpdated$: Observable<GameState>
  decisionRequired$: Observable<GameState>
  gameReset$: Observable<void>
}
