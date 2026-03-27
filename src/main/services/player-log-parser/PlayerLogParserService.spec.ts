// src/main/services/player-log-parser/PlayerLogParserService.spec.ts

import * as greTypes from "@shared/gre-types"
import { TGreToClientEvent } from "@shared/gre-types"
import { Subject } from "rxjs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { IPlayerLogWatchService } from "../player-log-watch/PlayerLogWatchService.interface"
import { PlayerLogParserService } from "./PlayerLogParserService"

// ---------------------------------------------------------------------------
// Mock parseLogLine at the module level
// ---------------------------------------------------------------------------

vi.mock("@shared/gre-types", async (importOriginal) => {
  const actual = await importOriginal<typeof greTypes>()
  return { ...actual, parseLogLine: vi.fn() }
})

const mockParseLogLine = vi.mocked(greTypes.parseLogLine)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FAKE_EVENT = { transactionId: "fake" } as unknown as TGreToClientEvent

// ---------------------------------------------------------------------------
// Mock watch service
// ---------------------------------------------------------------------------

function makeMockWatchService(): IPlayerLogWatchService & {
  subject: Subject<string>
} {
  const subject = new Subject<string>()
  return { log$: subject.asObservable(), subject }
}

// ---------------------------------------------------------------------------
// Tests
//
// Note: chunk.split("\n") on a newline-terminated string always produces a
// trailing empty string as the last element. e.g. "line\n".split("\n") =>
// ["line", ""]. The mock must return null for the empty string to avoid
// phantom emissions, which matches real parseLogLine behavior.
// ---------------------------------------------------------------------------

describe("PlayerLogParserService", () => {
  let watchService: ReturnType<typeof makeMockWatchService>
  let service: PlayerLogParserService

  beforeEach(() => {
    vi.resetAllMocks()
    // Default: return null so trailing empty strings don't accidentally emit
    mockParseLogLine.mockReturnValue(null)
    watchService = makeMockWatchService()
    service = new PlayerLogParserService(watchService)
  })

  it("emits a parsed event when parseLogLine succeeds on a complete line", () => {
    mockParseLogLine.mockImplementation((line) =>
      line === "some line" ? FAKE_EVENT : null,
    )
    const emitted: TGreToClientEvent[] = []
    service.events$.subscribe((e) => emitted.push(e))

    watchService.subject.next("some line\n")

    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toBe(FAKE_EVENT)
  })

  it("emits one event per line when a chunk contains multiple newline-separated lines", () => {
    mockParseLogLine.mockImplementation((line) =>
      line.startsWith("line") ? FAKE_EVENT : null,
    )
    const emitted: TGreToClientEvent[] = []
    service.events$.subscribe((e) => emitted.push(e))

    watchService.subject.next("line one\nline two\n")

    expect(emitted).toHaveLength(2)
  })

  it("does not emit when parseLogLine returns null for all lines", () => {
    mockParseLogLine.mockReturnValue(null)
    const emitted: TGreToClientEvent[] = []
    service.events$.subscribe((e) => emitted.push(e))

    watchService.subject.next("some line\n")

    expect(emitted).toHaveLength(0)
  })

  it("filters out null results and emits only successful parses in a mixed chunk", () => {
    mockParseLogLine.mockImplementation((line) =>
      line === "good line" ? FAKE_EVENT : null,
    )
    const emitted: TGreToClientEvent[] = []
    service.events$.subscribe((e) => emitted.push(e))

    watchService.subject.next("bad line\ngood line\nbad line\n")

    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toBe(FAKE_EVENT)
  })

  it("emits nothing for an empty chunk", () => {
    const emitted: TGreToClientEvent[] = []
    service.events$.subscribe((e) => emitted.push(e))

    watchService.subject.next("")

    expect(emitted).toHaveLength(0)
  })

  it("accumulates events correctly across multiple successive chunks", () => {
    mockParseLogLine.mockImplementation((line) =>
      line.startsWith("line") ? FAKE_EVENT : null,
    )
    const emitted: TGreToClientEvent[] = []
    service.events$.subscribe((e) => emitted.push(e))

    watchService.subject.next("line one\n")
    watchService.subject.next("line two\n")

    expect(emitted).toHaveLength(2)
  })
})
