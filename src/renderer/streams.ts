import { GameState } from "@shared/game-state-types"
import { scan, shareReplay } from "rxjs"
import { fromIpcChannel } from "./hooks/useIpcChannel"

export const playerLog$ = fromIpcChannel<string>("player-log").pipe(
  shareReplay({ bufferSize: 100, refCount: true }),
  // NOTE: We accumulate the full log string here so the PlayerLogViewer always
  // receives the complete text. We cannot slice to a character limit (e.g.
  // .slice(-100000)) without causing the log viewer to shift when old text is
  // removed while the user is scrolled up. Long-running sessions will grow
  // this string unboundedly — consider virtual scrolling or log rotation if
  // memory becomes a concern.
  scan((acc, val) => acc + val, ""),
)

export const gameState$ = fromIpcChannel<GameState>("game-state:updated").pipe(
  shareReplay({ bufferSize: 1, refCount: true }),
)
