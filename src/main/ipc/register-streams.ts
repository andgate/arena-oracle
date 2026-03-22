import { BrowserWindow, ipcMain } from "electron"
import { Observable, ReplaySubject, Subscription } from "rxjs"
import { ICoachingSnapshotService } from "../services/coaching-snapshot/ICoachingSnapshotService"
import { container } from "../services/container"
import { IGameStateService } from "../services/game-state/IGameStateService"
import { IPlayerLogService } from "../services/player-log/IPlayerLogService"

function bridgeStream<T>(
  channel: string,
  stream$: Observable<T>,
  win: BrowserWindow,
  replayBuffer = 1,
): void {
  // Buffer recent emissions for late renderer subscribers
  const replay$ = new ReplaySubject<T>(replayBuffer)
  const upstream: Subscription = stream$.subscribe(replay$)

  let rendererSub: Subscription | null = null

  ipcMain.on(`${channel}:subscribe`, () => {
    // Renderer is subscribing — drain the replay buffer then go live
    rendererSub = replay$.subscribe({
      next: (v) => win.webContents.send(`${channel}:next`, v),
      error: (e) =>
        win.webContents.send(`${channel}:error`, {
          message: (e as Error).message,
        }),
      complete: () => win.webContents.send(`${channel}:complete`),
    })
  })

  ipcMain.on(`${channel}:unsubscribe`, () => {
    rendererSub?.unsubscribe()
    rendererSub = null
  })

  // Clean up when the window closes
  win.on("closed", () => {
    rendererSub?.unsubscribe()
    upstream.unsubscribe()
  })
}

export function registerStreams(win: BrowserWindow): void {
  const playerLogService =
    container.resolve<IPlayerLogService>(IPlayerLogService)
  const gameStateService =
    container.resolve<IGameStateService>(IGameStateService)
  const coachingSnapshotService = container.resolve<ICoachingSnapshotService>(
    ICoachingSnapshotService,
  )

  bridgeStream("player-log", playerLogService.log$, win, 100)
  bridgeStream("game-state:updated", gameStateService.stateUpdated$, win)
  bridgeStream(
    "game-state:decision-required",
    gameStateService.decisionRequired$,
    win,
  )
  bridgeStream("game-state:reset", gameStateService.gameReset$, win)
  bridgeStream("coaching-snapshot", coachingSnapshotService.snapshot$, win)
}
