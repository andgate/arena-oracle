import { GameState } from "@shared/game-state-types"
import { scan, shareReplay } from "rxjs"
import { fromIpcChannel } from "./hooks/useIpcChannel"

export const playerLog$ = fromIpcChannel<string>("player-log").pipe(
  shareReplay({ bufferSize: 100, refCount: true }),
  scan((acc, val) => (acc + val).slice(-100000), ""),
)

export const gameState$ = fromIpcChannel<GameState>("game-state:updated").pipe(
  shareReplay({ bufferSize: 1, refCount: true }),
)
