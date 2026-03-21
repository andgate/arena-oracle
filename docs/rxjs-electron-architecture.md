# Reactive Streams Across Process Boundaries: Building a Production-Grade Electron App with RxJS, React, and tsyringe

Modern Electron apps face a structural challenge that most frontend architectures never encounter: your business logic runs in one operating system process, and your UI runs in another, with a serializing message bus — IPC — between them. Composing data pipelines across that boundary, without sacrificing correctness, testability, or the ergonomics you'd expect from a well-designed reactive system, requires careful thinking about primitives, lifecycle, and process topology.

This article walks through building a real system: a log-watching service that reads a file, parses structured JSON events from it, derives system state, and streams all of it — live — into a React UI running in the renderer process. Along the way we'll use RxJS for stream composition, tsyringe for dependency injection, and a deliberate lifecycle pattern to eliminate the race conditions that most naive implementations fall into.

The result is a clean, testable, MVVM-style architecture that scales naturally as your app grows.

---

## The System We're Building

The application consists of two main services on the Node/main side:

- **`LogWatcherService`** — reads a log file from disk, emits its initial contents as a single chunk, then tails it and emits new chunks as they're appended.
- **`LogParserService`** — consumes log chunks from `LogWatcherService`, extracts JSON log events, and folds them into a running `SystemState` object, emitting a new state on every meaningful update.

Both services expose their output as RxJS Observables. An IPC bridge serializes those Observables as named message channels. The renderer reconstructs them on the other side and feeds them into React components via custom hooks.

```
LogWatcherService (Node)
    │  log$: Subject<string>
    │
    ├──▶ LogParserService (Node)
    │         │  systemState$: BehaviorSubject<SystemState>
    │         │
    │      IPC Bridge
    │         │  'system-state' channel
    │         ▼
    │      Renderer
    │         └─▶ <AppDashboard>
    │
    └──▶ IPC Bridge
              │  'log-stream' channel
              ▼
           Renderer
              └─▶ <LogViewer>
```

---

## Why These Primitives?

Before writing code, it's worth being explicit about _which_ RxJS primitive is appropriate at each point in the system, because the wrong choice leads to either missed events or unnecessary complexity.

**`Subject<string>` for `log$`** — The log watcher emits a sequence where every chunk matters and must be delivered in order. We'll ensure via lifecycle design that no subscriber can ever miss an emission, so we don't need buffering. A plain `Subject` is honest about that contract.

**`BehaviorSubject<SystemState>` for `systemState$`** — System state is a _value that changes_, not a sequence of events. The renderer only ever needs the latest state. `BehaviorSubject` provides exactly this: it holds one value, emits it synchronously to any new subscriber, and keeps the latest value accessible via `.getValue()`. No buffering strategy needed.

**`ReplaySubject<T>` in the IPC bridge** — The IPC boundary is the one place where timing genuinely can't be perfectly controlled. The main process starts emitting before the renderer's `useEffect` hooks have fired. A `ReplaySubject` in the bridge buffers recent emissions so a slightly-late renderer subscriber still gets a full picture. This is scoped _only_ to the IPC bridge, not to the services themselves.

**`shareReplay({ bufferSize: 1, refCount: true })` in the renderer** — Multiple React components may subscribe to the same IPC-backed Observable. `shareReplay(1)` ensures only one IPC subscription is ever created, and that late-mounting components immediately receive the current value.

---

## Project Structure

```
src/
├── main/
│   ├── container.ts                    # DI wiring
│   ├── fs/
│   │   ├── IFileSystem.ts
│   │   ├── RealFileSystem.ts
│   │   └── MockFileSystem.ts           # for tests
│   ├── services/
│   │   ├── ILogWatcherService.ts
│   │   ├── LogWatcherService.ts
│   │   ├── ILogParserService.ts
│   │   └── LogParserService.ts
│   └── ipc/
│       └── registerStreams.ts
├── preload.ts
└── renderer/
    ├── index.tsx
    ├── streams.ts                      # shared renderer-side Observables
    ├── hooks.ts                        # useObservable, fromIpcChannel
    └── components/
        ├── LogViewer.tsx
        └── AppDashboard.tsx
```

---

## The Filesystem Abstraction

We abstract `fs` behind an interface so `LogWatcherService` can be unit-tested without touching the real filesystem.

```typescript
// src/main/fs/IFileSystem.ts
import type { FSWatcher, ReadStream } from "fs"

export const IFileSystem = Symbol("IFileSystem")

export interface IFileSystem {
  readFileSync(path: string, encoding: BufferEncoding): string
  statSync(path: string): { size: number }
  watch(path: string): FSWatcher
  createReadStream(
    path: string,
    options: { start: number; encoding: BufferEncoding },
  ): ReadStream
  existsSync(path: string): boolean
  writeFileSync(path: string, data: string): void
}
```

```typescript
// src/main/fs/RealFileSystem.ts
import * as fs from "fs"
import { injectable } from "tsyringe"
import { IFileSystem } from "./IFileSystem"

@singleton()
@injectable()
export class RealFileSystem implements IFileSystem {
  readFileSync(path: string, encoding: BufferEncoding): string {
    return fs.readFileSync(path, encoding)
  }

  statSync(path: string): { size: number } {
    return fs.statSync(path)
  }

  watch(path: string): fs.FSWatcher {
    return fs.watch(path)
  }

  createReadStream(
    path: string,
    options: { start: number; encoding: BufferEncoding },
  ): fs.ReadStream {
    return fs.createReadStream(path, options)
  }

  existsSync(path: string): boolean {
    return fs.existsSync(path)
  }

  writeFileSync(path: string, data: string): void {
    fs.writeFileSync(path, data)
  }
}
```

---

## The Startable Lifecycle Interface

The most important architectural decision in this system is the explicit lifecycle: services are constructed first, subscriptions are wired, and then I/O begins. This is enforced by an `IStartable` interface.

```typescript
// src/main/IStartable.ts
export const IStartable = Symbol("IStartable")

export interface IStartable {
  start(): void
}
```

---

## LogWatcherService

The log watcher reads the full file on `start()`, tracks the byte position, and uses `fs.watch` to tail subsequent appends. Crucially, nothing runs until `start()` is called — the service is constructed and subscribed-to before any I/O touches the filesystem.

```typescript
// src/main/services/ILogWatcherService.ts
import { Observable } from "rxjs"

export const ILogWatcherService = Symbol("ILogWatcherService")

export interface ILogWatcherService {
  readonly log$: Observable<string>
}
```

```typescript
// src/main/services/LogWatcherService.ts
import { inject, injectable, singleton } from "tsyringe"
import { Subject } from "rxjs"
import { IFileSystem } from "../fs/IFileSystem"
import { IStartable } from "../IStartable"
import { ILogWatcherService } from "./ILogWatcherService"

@singleton()
@injectable()
export class LogWatcherService implements ILogWatcherService, IStartable {
  readonly log$ = new Subject<string>()

  private logPath: string

  constructor(@inject(IFileSystem) private fs: IFileSystem) {
    // Resolved from app.getPath('userData') at startup before start() is called
    this.logPath = ""
  }

  setLogPath(path: string): void {
    this.logPath = path
  }

  start(): void {
    if (!this.fs.existsSync(this.logPath)) {
      this.fs.writeFileSync(this.logPath, "")
    }

    // Emit the full initial contents
    const initial = this.fs.readFileSync(this.logPath, "utf-8")
    let position = Buffer.byteLength(initial, "utf-8")
    this.log$.next(initial)

    const watcher = this.fs.watch(this.logPath)

    watcher.on("change", () => {
      const { size: newSize } = this.fs.statSync(this.logPath)
      if (newSize <= position) return // truncation or no-op

      const stream = this.fs.createReadStream(this.logPath, {
        start: position,
        encoding: "utf-8",
      })

      stream.on("data", (chunk: string) => {
        position += Buffer.byteLength(chunk, "utf-8")
        this.log$.next(chunk)
      })

      stream.on("error", (err: Error) => this.log$.error(err))
    })

    watcher.on("error", (err: Error) => this.log$.error(err))
  }
}
```

The byte-cursor approach (`position`) is what makes the sequence gapless and duplicate-free. `readFileSync` reads bytes `0..N`; the watcher reads from `N` onward. There is no overlap window.

---

## LogParserService

The parser subscribes to `log$` in its constructor. Because `start()` hasn't been called yet, there are no emissions — the subscription simply registers interest in future values. When `LogWatcherService.start()` fires, chunks flow through immediately.

```typescript
// src/main/services/ILogParserService.ts
import { Observable } from "rxjs"

export const ILogParserService = Symbol("ILogParserService")

export interface SystemState {
  status: "ok" | "degraded" | "error"
  lastEvent: string
  timestamp: number
  metadata: Record<string, unknown>
}

export const initialSystemState: SystemState = {
  status: "ok",
  lastEvent: "",
  timestamp: 0,
  metadata: {},
}

export interface ILogParserService {
  readonly systemState$: Observable<SystemState>
}
```

```typescript
// src/main/services/LogParserService.ts
import { inject, injectable, singleton } from "tsyringe"
import { BehaviorSubject } from "rxjs"
import { scan, map, filter } from "rxjs/operators"
import { ILogWatcherService } from "./ILogWatcherService"
import {
  ILogParserService,
  SystemState,
  initialSystemState,
} from "./ILogParserService"

interface LogEvent {
  level: "info" | "warn" | "error"
  message?: string
  timestamp?: number
  metadata?: Record<string, unknown>
}

function parseBuffer(buffer: string): LogEvent[] {
  return buffer
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as LogEvent]
      } catch {
        return []
      }
    })
}

function reduceEvents(state: SystemState, events: LogEvent[]): SystemState {
  return events.reduce(
    (acc, event) => ({
      status:
        event.level === "error"
          ? "error"
          : event.level === "warn" && acc.status !== "error"
            ? "degraded"
            : acc.status,
      lastEvent: event.message ?? acc.lastEvent,
      timestamp: event.timestamp ?? Date.now(),
      metadata: { ...acc.metadata, ...event.metadata },
    }),
    state,
  )
}

@singleton()
@injectable()
export class LogParserService implements ILogParserService {
  readonly systemState$ = new BehaviorSubject<SystemState>(initialSystemState)

  constructor(@inject(ILogWatcherService) watcher: ILogWatcherService) {
    // Wired before start() is ever called — safe to subscribe immediately
    watcher.log$
      .pipe(
        scan((buffer, chunk) => buffer + chunk, ""),
        map(parseBuffer),
        filter((events) => events.length > 0),
        scan(reduceEvents, initialSystemState),
      )
      .subscribe((state) => this.systemState$.next(state))
  }
}
```

Note that `LogParserService` has no `start()` method. Its pipeline is declarative and driven entirely by emissions from `log$`. The only service that needs a meaningful `start()` is the one that owns I/O.

---

## Dependency Injection with tsyringe

The container is the single place where interfaces are bound to concrete implementations. Nothing outside of `container.ts` should ever import `RealFileSystem`.

```typescript
// src/main/container.ts
import "reflect-metadata"
import { container } from "tsyringe"
import { IFileSystem } from "./fs/IFileSystem"
import { RealFileSystem } from "./fs/RealFileSystem"
import { ILogWatcherService } from "./services/ILogWatcherService"
import { LogWatcherService } from "./services/LogWatcherService"
import { ILogParserService } from "./services/ILogParserService"
import { LogParserService } from "./services/LogParserService"
import { IStartable } from "./IStartable"

// Bind interfaces to implementations
container.register(IFileSystem, { useToken: RealFileSystem })
container.register(ILogWatcherService, { useToken: LogWatcherService })
container.register(ILogParserService, { useToken: LogParserService })

// Register all startable services under the shared token (in startup order)
container.register(IStartable, { useToken: LogWatcherService })

export { container }
```

Resolution is automatic. When `container.resolve(LogParserService)` is called, tsyringe sees the `@inject(ILogWatcherService)` decorator, resolves `LogWatcherService` (which itself resolves `RealFileSystem` via `@inject(IFileSystem)`), and hands back a fully-wired singleton graph.

---

## The IPC Bridge

The bridge is where Node-side Observables become IPC message channels. The key design here is the `ReplaySubject` at the boundary: it buffers recent emissions for any renderer subscriber that arrives slightly late due to `useEffect` scheduling.

```typescript
// src/main/ipc/registerStreams.ts
import { BrowserWindow, ipcMain } from "electron"
import { Observable, ReplaySubject, Subscription } from "rxjs"
import { container } from "../container"
import { LogWatcherService } from "../services/LogWatcherService"
import { LogParserService } from "../services/LogParserService"

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
  const watcher = container.resolve(LogWatcherService)
  const parser = container.resolve(LogParserService)

  bridgeStream("log-stream", watcher.log$, win, 100)
  bridgeStream("system-state", parser.systemState$, win, 1) // BehaviorSubject — 1 is enough
}
```

The `system-state` channel only needs a replay buffer of 1 because `systemState$` is a `BehaviorSubject` — it already guarantees a current value. The `log-stream` buffer of 100 is a reasonable ceiling for startup burst without meaningful memory cost.

---

## Main Process Entry Point

The startup sequence is: construct → subscribe → start. The renderer controls when `start()` fires.

```typescript
// src/main.ts
import "reflect-metadata"
import { app, BrowserWindow, ipcMain } from "electron"
import * as path from "path"
import { container } from "./main/container"
import { LogWatcherService } from "./main/services/LogWatcherService"
import { registerStreams } from "./main/ipc/registerStreams"
import { IStartable } from "./main/IStartable"

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
    },
  })

  win.loadFile("index.html")

  // Step 1: Resolve the object graph (no I/O yet)
  const watcher = container.resolve(LogWatcherService)
  watcher.setLogPath(path.join(app.getPath("userData"), "app.log"))

  // Step 2: Wire the IPC bridges (main process is now subscribed)
  registerStreams(win)

  // Step 3: Wait for the renderer to signal it's mounted
  ipcMain.once("app:ready", () => {
    // All subscribers (Node services + IPC bridge) are attached
    // Now it's safe to start I/O
    container.resolveAll<IStartable>(IStartable).forEach((s) => s.start())
  })
})
```

---

## Preload Script

> [!WARNING]
> **The ContextBridge Listener Leak**
> Exposing IPC directly through `contextBridge` introduces a subtle memory leak when unsubscribing. Functions created in the renderer and passed to the main world via `contextBridge` are stripped by Electron and wrapped in an anonymous native function (e.g., `(_event, ...args) => cb(...args)`). If your `.removeListener` method receives the *original* generic `cb` from the renderer, it will fail to remove the native wrapper. You must maintain a `WeakMap` inside the preload script to map the renderer callback to its native wrapper format so it can be successfully deregistered.

```typescript
// src/preload.ts
import { contextBridge, ipcRenderer } from "electron"

const listenerMap = new WeakMap<
  (...args: any[]) => void,
  (_event: Electron.IpcRendererEvent, ...args: any[]) => void
>()

contextBridge.exposeInMainWorld("ipcBridge", {
  send: (channel: string, ...args: unknown[]) =>
    ipcRenderer.send(channel, ...args),

  on: (channel: string, cb: (...args: unknown[]) => void) => {
    const wrapper = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      cb(...args)
    listenerMap.set(cb, wrapper)
    ipcRenderer.on(channel, wrapper)
  },

  once: (channel: string, cb: (...args: unknown[]) => void) => {
    const wrapper = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      cb(...args)
    listenerMap.set(cb, wrapper)
    ipcRenderer.once(channel, wrapper)
  },

  remove: (channel: string, cb: (...args: unknown[]) => void) => {
    const wrapper = listenerMap.get(cb)
    if (wrapper) {
      ipcRenderer.removeListener(channel, wrapper)
      listenerMap.delete(cb)
    }
  },
})
```

---

## Renderer: Hooks

The two core hooks are `fromIpcChannel` — which reconstructs an Observable from a named IPC channel — and `useObservable`, which subscribes and pours values into React state.

```typescript
// src/renderer/hooks.ts
import { useState, useEffect, useMemo } from "react"
import { Observable } from "rxjs"

declare global {
  interface Window {
    ipcBridge: {
      send: (channel: string, ...args: unknown[]) => void
      on: (channel: string, cb: (...args: unknown[]) => void) => void
      once: (channel: string, cb: (...args: unknown[]) => void) => void
      remove: (channel: string, cb: (...args: unknown[]) => void) => void
    }
  }
}

export function fromIpcChannel<T>(channel: string): Observable<T> {
  return new Observable<T>((subscriber) => {
    window.ipcBridge.send(`${channel}:subscribe`)

    const onNext = (value: T) => subscriber.next(value)
    const onError = (err: { message: string }) =>
      subscriber.error(new Error(err.message))
    const onComplete = () => subscriber.complete()

    window.ipcBridge.on(`${channel}:next`, onNext)
    window.ipcBridge.on(`${channel}:error`, onError)
    window.ipcBridge.once(`${channel}:complete`, onComplete)

    return () => {
      window.ipcBridge.send(`${channel}:unsubscribe`)
      window.ipcBridge.remove(`${channel}:next`, onNext)
      window.ipcBridge.remove(`${channel}:error`, onError)
      window.ipcBridge.remove(`${channel}:complete`, onComplete)
    }
  })
}
```

---

## Renderer: Shared Streams

Streams are created once, outside React, and shared across the entire app with `shareReplay`. This ensures a single IPC subscription regardless of how many components consume the stream.

```typescript
// src/renderer/streams.ts
import { shareReplay } from "rxjs/operators"
import { fromIpcChannel } from "./hooks"
import {
  SystemState,
  initialSystemState,
} from "../main/services/ILogParserService"

// One IPC subscription, shared across all consumers.
// shareReplay(1) multicasts and replays the latest value to late subscribers.
export const log$ = fromIpcChannel<string>("log-stream").pipe(
  shareReplay({ bufferSize: 1, refCount: true }),
)

export const systemState$ = fromIpcChannel<SystemState>("system-state").pipe(
  shareReplay({ bufferSize: 1, refCount: true }),
)
```

---

## Renderer: Components

```typescript
// src/renderer/components/LogViewer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { log$ } from '../streams';

export function LogViewer(): React.JSX.Element {
  const [lines, setLines] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sub = log$.subscribe((chunk) => {
      if (!chunk) return;
      setLines((prev) => [...prev, ...chunk.split('\n').filter(Boolean)]);
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.dot} /> Live Log
      </div>
      <div style={styles.logBox}>
        {lines.length === 0 && (
          <span style={styles.empty}>Waiting for log entries...</span>
        )}
        {lines.map((line, i) => (
          <div key={i} style={styles.line}>
            <span style={styles.lineNum}>{String(i + 1).padStart(4, '0')}</span>
            <span>{line}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
```

```typescript
// src/renderer/components/AppDashboard.tsx
import React, { useEffect, useState } from 'react';
import { systemState$ } from '../streams';
import { initialSystemState } from '../../main/services/ILogParserService';

const statusColors: Record<string, string> = {
  ok: '#4caf50',
  degraded: '#ff9800',
  error: '#f44336',
};

export function AppDashboard(): React.JSX.Element {
  const [state, setState] = useState(initialSystemState);

  useEffect(() => {
    const sub = systemState$.subscribe(setState);
    return () => sub.unsubscribe();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h2>System Status</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          width: 12, height: 12, borderRadius: '50%',
          background: statusColors[state.status] ?? '#999',
          display: 'inline-block',
        }} />
        <strong style={{ textTransform: 'capitalize' }}>{state.status}</strong>
      </div>
      <p style={{ color: '#666', marginTop: 8 }}>{state.lastEvent || 'No events yet'}</p>
      <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 12 }}>
        {JSON.stringify(state.metadata, null, 2)}
      </pre>
    </div>
  );
}
```

---

## Renderer: Entry Point

```typescript
// src/renderer/index.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { LogViewer } from './components/LogViewer';
import { AppDashboard } from './components/AppDashboard';

function App(): React.JSX.Element {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100vh' }}>
      <AppDashboard />
      <LogViewer />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

// Signal to main that the renderer is mounted.
// The IPC bridge's ReplaySubject covers the small window between
// app:ready and useEffect subscriptions firing.
window.ipcBridge.send('app:ready');
```

---

## Testing Strategy

Because every service depends on an interface rather than a concrete implementation, `Subject` acts as a universal test double across the entire stack. There is no Electron, no filesystem, and no IPC involved in any unit test.

### Testing LogWatcherService

The watcher owns real I/O, so it warrants an integration test using a temp file. This is fast, deterministic, and tests the actual `fs.watch` + byte-cursor behavior.

```typescript
// src/main/services/LogWatcherService.test.ts
import "reflect-metadata"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { container } from "tsyringe"
import { take, toArray } from "rxjs/operators"
import { IFileSystem } from "../fs/IFileSystem"
import { RealFileSystem } from "../fs/RealFileSystem"
import { LogWatcherService } from "./LogWatcherService"

describe("LogWatcherService", () => {
  let tmpFile: string
  let service: LogWatcherService

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `log-test-${Date.now()}.log`)
    fs.writeFileSync(tmpFile, "initial line\n")

    const testContainer = container.createChildContainer()
    testContainer.register(IFileSystem, { useClass: RealFileSystem })
    service = testContainer.resolve(LogWatcherService)
    service.setLogPath(tmpFile)
  })

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
  })

  it("emits the full initial file contents on start()", (done) => {
    service.log$.pipe(take(1)).subscribe((chunk) => {
      expect(chunk).toContain("initial line")
      done()
    })

    service.start()
  })

  it("emits new chunks appended after start()", (done) => {
    service.log$.pipe(take(2), toArray()).subscribe((chunks) => {
      expect(chunks[1]).toContain("appended line")
      done()
    })

    service.start()

    setTimeout(() => {
      fs.appendFileSync(tmpFile, "appended line\n")
    }, 50)
  })

  it("does not re-emit bytes already delivered (no duplicates)", (done) => {
    const received: string[] = []

    service.log$.pipe(take(2), toArray()).subscribe((chunks) => {
      received.push(...chunks)
      const full = received.join("")
      const occurrences = full.split("initial line").length - 1
      expect(occurrences).toBe(1) // 'initial line' appears exactly once
      done()
    })

    service.start()

    setTimeout(() => {
      fs.appendFileSync(tmpFile, "second line\n")
    }, 50)
  })
})
```

### Testing LogParserService

The parser is a pure data transformation pipeline. Inject a `Subject` as the log source — no filesystem, no Electron, no async surprises.

```typescript
// src/main/services/LogParserService.test.ts
import "reflect-metadata"
import { Subject } from "rxjs"
import { container } from "tsyringe"
import { take } from "rxjs/operators"
import { ILogWatcherService } from "./ILogWatcherService"
import { LogParserService } from "./LogParserService"

describe("LogParserService", () => {
  let logSubject: Subject<string>
  let parser: LogParserService

  beforeEach(() => {
    logSubject = new Subject<string>()

    const testContainer = container.createChildContainer()
    testContainer.register(ILogWatcherService, {
      useValue: { log$: logSubject },
    })

    parser = testContainer.resolve(LogParserService)
  })

  function emit(event: object): void {
    logSubject.next(JSON.stringify(event) + "\n")
  }

  it("starts with the initial system state", () => {
    expect(parser.systemState$.getValue().status).toBe("ok")
  })

  it("updates lastEvent from info-level log entries", (done) => {
    parser.systemState$.pipe(take(2)).subscribe({
      complete: () => {
        expect(parser.systemState$.getValue().lastEvent).toBe("Server started")
        done()
      },
    })

    emit({ level: "info", message: "Server started", timestamp: 1000 })
  })

  it("transitions status to degraded on warn", (done) => {
    parser.systemState$.pipe(take(2)).subscribe({
      complete: () => {
        expect(parser.systemState$.getValue().status).toBe("degraded")
        done()
      },
    })

    emit({ level: "warn", message: "High memory usage" })
  })

  it("transitions status to error on error-level log", (done) => {
    parser.systemState$.pipe(take(2)).subscribe({
      complete: () => {
        expect(parser.systemState$.getValue().status).toBe("error")
        done()
      },
    })

    emit({ level: "error", message: "Unhandled exception" })
  })

  it("handles chunks that split mid-JSON boundary", (done) => {
    parser.systemState$.pipe(take(2)).subscribe({
      complete: () => {
        expect(parser.systemState$.getValue().lastEvent).toBe(
          "Split across chunks",
        )
        done()
      },
    })

    const line =
      JSON.stringify({ level: "info", message: "Split across chunks" }) + "\n"
    const mid = Math.floor(line.length / 2)
    logSubject.next(line.slice(0, mid))
    logSubject.next(line.slice(mid))
  })

  it("merges metadata across successive events", (done) => {
    parser.systemState$.pipe(take(3)).subscribe({
      complete: () => {
        const { metadata } = parser.systemState$.getValue()
        expect(metadata).toMatchObject({ region: "us-east", version: "2.1.0" })
        done()
      },
    })

    emit({ level: "info", message: "Boot", metadata: { region: "us-east" } })
    emit({ level: "info", message: "Ready", metadata: { version: "2.1.0" } })
  })
})
```

---

## The Full Startup Sequence

To make the lifecycle concrete, here is the complete ordered sequence from app launch to first emission:

```
1.  app.whenReady() fires
2.  BrowserWindow is created
3.  container.resolve(LogWatcherService)
      → RealFileSystem is instantiated
      → LogWatcherService is instantiated (log$ Subject created, no I/O)
4.  container.resolve(LogParserService)  [via registerStreams]
      → LogParserService is instantiated
      → Subscribes to watcher.log$ (pipeline wired, no emissions yet)
5.  registerStreams() bridges log$ and systemState$ via ReplaySubject
      → IPC bridge subscribed to both Observables (still no I/O)
6.  win.loadFile() — renderer begins loading
7.  Renderer React tree mounts
      → useEffect runs, renderer calls fromIpcChannel → sends 'log-stream:subscribe'
      → IPC bridge begins forwarding to renderer
8.  renderer sends 'app:ready'
9.  main receives 'app:ready' → calls LogWatcherService.start()
      → fs.readFileSync runs — initial chunk emitted to log$
      → fs.watch starts — subsequent chunks emitted as file grows
10. Chunks flow: log$ → LogParserService pipeline → systemState$ → IPC bridges → renderer hooks → React state → render
```

At step 9, every subscriber in the system — the parser, both IPC bridges, and the renderer — is already attached. Nothing can be missed.

---

## Summary: Primitives and Their Roles

| Location                        | Primitive                                        | Reason                                                           |
| ------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| `LogWatcherService.log$`        | `Subject<string>`                                | Sequence; lifecycle guarantees no missed emissions               |
| `LogParserService.systemState$` | `BehaviorSubject<SystemState>`                   | Current value; late subscribers always get latest state          |
| IPC bridge internals            | `ReplaySubject<T>(n)`                            | Absorbs the small timing gap between `app:ready` and `useEffect` |
| Renderer `streams.ts`           | `shareReplay({ bufferSize: 1, refCount: true })` | One IPC subscription shared across multiple React components     |

The system is correct at every boundary: the Node services are correct by lifecycle design, the IPC bridge is resilient by buffering, and the renderer is efficient by sharing. Each layer uses exactly the primitive that matches its actual requirement — and nothing more.
