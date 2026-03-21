import { shareReplay } from "rxjs"
import { fromIpcChannel } from "./hooks/useIpcChannel"

export const playerLog$ = fromIpcChannel<string>("player-log").pipe(
  shareReplay({ bufferSize: 1, refCount: true }),
)
