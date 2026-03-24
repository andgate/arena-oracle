import {
  MOCK_WATCH_INTERVAL_MS,
  MockFileSystem,
} from "@main/utils/fs/MockFileSystem"
import { test as baseTest, describe, expect, vi } from "vitest"
import { PlayerLogService } from "./PlayerLogService"

const LOG_PATH = "/test/Player.log"

// Override the path resolver so the service uses our test path
vi.mock("@main/utils/mtga-paths", () => ({
  getMtgaPlayerLogPath: () => LOG_PATH,
}))

type Fixtures = {
  mockFs: MockFileSystem
  service: PlayerLogService
}

const test = baseTest.extend<Fixtures>({
  mockFs: async ({}, use) => {
    await use(new MockFileSystem())
  },
  service: async ({ mockFs }, use) => {
    await use(new PlayerLogService(mockFs))
  },
})

describe("PlayerLogService", () => {
  test("creates the log file if it does not exist on start()", ({
    service,
    mockFs,
  }) => {
    service.start()
    expect(mockFs.existsSync(LOG_PATH)).toBe(true)
  })

  test("does not overwrite the log file if it already exists on start()", ({
    service,
    mockFs,
  }) => {
    mockFs.writeFileSync(LOG_PATH, "existing content")
    service.start()
    expect(mockFs.readFileSync(LOG_PATH, "utf-8")).toBe("existing content")
  })

  test("emits initial file contents as chunks via log$ on start()", async ({
    service,
    mockFs,
  }) => {
    mockFs.writeFileSync(LOG_PATH, "hello world")

    const chunks: string[] = []
    service.log$.subscribe((chunk) => chunks.push(chunk))
    service.start()

    // Wait for the stream to finish
    await new Promise((r) => setTimeout(r, 50))

    expect(chunks.join("")).toBe("hello world")
    expect(chunks).toHaveLength(1)
  })

  test("late subscribers receive buffered chunks from ReplaySubject", async ({
    service,
    mockFs,
  }) => {
    mockFs.writeFileSync(LOG_PATH, "buffered data")
    service.start()

    await new Promise((r) => setTimeout(r, 50))

    const chunks: string[] = []
    service.log$.subscribe((chunk) => chunks.push(chunk))

    expect(chunks.join("")).toBe("buffered data")
  })

  test("calls unwatchFile on stop()", ({ service, mockFs }) => {
    const unwatchSpy = vi.spyOn(mockFs, "unwatchFile")
    service.start()
    service.stop()
    expect(unwatchSpy).toHaveBeenCalledWith(LOG_PATH)
  })

  test("emits new bytes when file grows", async ({ service, mockFs }) => {
    mockFs.writeFileSync(LOG_PATH, "initial")
    service.start()

    // Wait for initial read to complete
    await new Promise((r) => setTimeout(r, 50))

    const chunks: string[] = []
    service.log$.subscribe((chunk) => chunks.push(chunk))

    mockFs.writeFileSync(LOG_PATH, "initial appended")

    await new Promise((r) => setTimeout(r, MOCK_WATCH_INTERVAL_MS + 100))

    expect(chunks.join("")).toContain("appended")
    expect(chunks).toHaveLength(2)
  }, 5000)

  test("resets fileOffset to 0 when file shrinks (log rotation)", async ({
    service,
    mockFs,
  }) => {
    mockFs.writeFileSync(LOG_PATH, "original content")
    service.start()

    await new Promise((r) => setTimeout(r, 50))

    const chunks: string[] = []
    service.log$.subscribe((chunk) => chunks.push(chunk))

    // Simulate log rotation — new content is shorter than original
    mockFs.writeFileSync(LOG_PATH, "new")

    await new Promise((r) => setTimeout(r, MOCK_WATCH_INTERVAL_MS + 50))

    expect(chunks.join("")).toContain("new")
  }, 5000)

  test("does not emit when file size is unchanged", async ({
    service,
    mockFs,
  }) => {
    mockFs.writeFileSync(LOG_PATH, "initial")
    service.start()

    await new Promise((r) => setTimeout(r, 50))

    const chunks: string[] = []
    service.log$.subscribe((chunk) => chunks.push(chunk))

    // Overwrite with same-length content — watchFile should no-op
    mockFs.writeFileSync(LOG_PATH, "changed")

    await new Promise((r) => setTimeout(r, MOCK_WATCH_INTERVAL_MS + 50))

    expect(chunks).toHaveLength(1)
  }, 5000)
})
