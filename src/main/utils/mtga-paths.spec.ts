import {
  getMtgaPlayerLogPath,
  getMtgaRawDataPath,
} from "@main/utils/mtga-paths"
import { execSync } from "child_process"
import { app } from "electron"
import fs from "fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("child_process", () => ({ execSync: vi.fn() }))
vi.mock("fs", () => ({ default: { existsSync: vi.fn() } }))
vi.mock("electron", () => ({ app: { getPath: vi.fn() } }))

const mockExecSync = vi.mocked(execSync)
const mockExistsSync = vi.mocked(fs.existsSync)
const mockGetPath = vi.mocked(app.getPath)

describe("getMtgaPlayerLogPath", () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
    vi.resetAllMocks()
  })

  it("returns the injected env var directly when MTGA_PLAYER_LOG_PATH is set", () => {
    process.env.MTGA_PLAYER_LOG_PATH = "C:\\custom\\path\\Player.log"
    expect(getMtgaPlayerLogPath()).toBe("C:\\custom\\path\\Player.log")
    expect(mockGetPath).not.toHaveBeenCalled()
  })

  it("resolves path from app.getPath('appData') when env var is not set", () => {
    delete process.env.MTGA_PLAYER_LOG_PATH
    mockGetPath.mockReturnValue("C:\\Users\\TestUser\\AppData\\Roaming")

    const result = getMtgaPlayerLogPath()

    expect(mockGetPath).toHaveBeenCalledWith("appData")
    expect(result).toBe(
      "C:\\Users\\TestUser\\AppData\\LocalLow\\Wizards Of The Coast\\MTGA\\Player.log",
    )
  })
})

describe("getMtgaRawDataPath", () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.resetAllMocks()
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it("returns the injected env var directly when MTGA_RAW_DATA_PATH is set", () => {
    process.env.MTGA_RAW_DATA_PATH = "C:\\custom\\raw\\data"
    expect(getMtgaRawDataPath()).toBe("C:\\custom\\raw\\data")
    expect(mockExecSync).not.toHaveBeenCalled()
    expect(mockExistsSync).not.toHaveBeenCalled()
  })

  it("returns the Steam-registry-resolved path when reg query succeeds and path exists", () => {
    delete process.env.MTGA_RAW_DATA_PATH

    mockExecSync.mockReturnValue(
      "    SteamPath    REG_SZ    C:/Program Files (x86)/Steam\r\n",
    )
    mockExistsSync.mockReturnValue(true)

    const result = getMtgaRawDataPath()

    expect(result).toBe(
      "C:\\Program Files (x86)\\Steam\\steamapps\\common\\MTGA\\MTGA_Data\\Downloads\\Raw",
    )
    // existsSync should have been checked for the Steam path — and returned true, so we stop there
    expect(mockExistsSync).toHaveBeenCalledTimes(1)
  })

  it("falls back to hardcoded paths when the Steam registry path does not exist on disk", () => {
    delete process.env.MTGA_RAW_DATA_PATH

    mockExecSync.mockReturnValue(
      "    SteamPath    REG_SZ    C:/Program Files (x86)/Steam\r\n",
    )
    // Steam path doesn't exist, but first hardcoded fallback does
    mockExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true)

    const result = getMtgaRawDataPath()

    expect(result).toBe(
      "C:\\Program Files\\Wizards of the Coast\\MTGA\\MTGA_Data\\Downloads\\Raw",
    )
  })

  it("falls back to hardcoded paths when the Steam registry query throws", () => {
    delete process.env.MTGA_RAW_DATA_PATH

    mockExecSync.mockImplementation(() => {
      throw new Error("reg query failed")
    })
    mockExistsSync.mockReturnValueOnce(true)

    const result = getMtgaRawDataPath()

    expect(result).toBe(
      "C:\\Program Files\\Wizards of the Coast\\MTGA\\MTGA_Data\\Downloads\\Raw",
    )
  })

  it("falls back to hardcoded paths when the Steam registry output does not match", () => {
    delete process.env.MTGA_RAW_DATA_PATH

    mockExecSync.mockReturnValue("unexpected registry output")
    mockExistsSync.mockReturnValueOnce(true)

    const result = getMtgaRawDataPath()

    expect(result).toBe(
      "C:\\Program Files\\Wizards of the Coast\\MTGA\\MTGA_Data\\Downloads\\Raw",
    )
  })

  it("returns the first existing hardcoded path, in order", () => {
    delete process.env.MTGA_RAW_DATA_PATH

    mockExecSync.mockImplementation(() => {
      throw new Error("no steam")
    })
    // First hardcoded path doesn't exist, second does
    mockExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true)

    const result = getMtgaRawDataPath()

    expect(result).toBe(
      "C:\\Program Files (x86)\\Wizards of the Coast\\MTGA\\MTGA_Data\\Downloads\\Raw",
    )
  })

  it("returns null when no Steam path and no hardcoded path exists", () => {
    delete process.env.MTGA_RAW_DATA_PATH

    mockExecSync.mockImplementation(() => {
      throw new Error("no steam")
    })
    mockExistsSync.mockReturnValue(false)

    expect(getMtgaRawDataPath()).toBeNull()
  })
})
