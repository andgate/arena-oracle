import { BrowserWindow, ipcMain } from "electron"
import { Observable, ReplaySubject, Subscription } from "rxjs"
import { container } from "../services/container"
import { PlayerLogService } from "../services/player-log/PlayerLogService"

function bridgeStream<T>(
  channel: string,
  stream$: Observable<T>,
  win: BrowserWindow,
  replayBuffer = 100,
): void {
  // Buffer recent emissions for late renderer subscribers
  const replay$ = new ReplaySubject<T>(replayBuffer)
  const upstream: Subscription = stream$.subscribe(replay$)

  let rendererSub: Subscription | null = null

  ipcMain.on(`${channel}:subscribe`, () => {
    console.log(`[bridge] renderer subscribed to ${channel}`)
    // Renderer is subscribing — drain the replay buffer then go live
    rendererSub = replay$.subscribe({
      next: (v) => {
        console.log(`[bridge] sending ${channel}:next`)
        win.webContents.send(`${channel}:next`, v)
      },
      error: (e) =>
        win.webContents.send(`${channel}:error`, {
          message: (e as Error).message,
        }),
      complete: () => win.webContents.send(`${channel}:complete`),
    })
    console.log(`[bridge] replay drained for ${channel}`)
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
  const playerLogService = container.resolve(PlayerLogService)

  bridgeStream("player-log", playerLogService.log$, win, 100)
}
