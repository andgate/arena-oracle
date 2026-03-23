import { execSync } from "child_process"
import { app } from "electron"
import fs from "fs"
import path from "path"

const MTGA_RAW_DATA_PATHS = [
  // Standalone installer paths
  "C:\\Program Files\\Wizards of the Coast\\MTGA\\MTGA_Data\\Downloads\\Raw",
  "C:\\Program Files (x86)\\Wizards of the Coast\\MTGA\\MTGA_Data\\Downloads\\Raw",
  // Steam hardcoded fallbacks
  "C:\\Program Files (x86)\\Steam\\steamapps\\common\\MTGA\\MTGA_Data\\Downloads\\Raw",
  "C:\\Program Files\\Steam\\steamapps\\common\\MTGA\\MTGA_Data\\Downloads\\Raw",
]

function getSteamPath(): string | null {
  try {
    const result = execSync(
      `reg query "HKCU\\Software\\Valve\\Steam" /v "SteamPath"`,
      { encoding: "utf-8" },
    )
    const match = result.match(/SteamPath\s+REG_SZ\s+(.+)/)
    if (!match) return null
    return match[1].trim().replace(/\//g, "\\")
  } catch {
    return null
  }
}

function findMtgaRawDataPath(): string | null {
  // Try Steam install via registry first
  const steamPath = getSteamPath()
  if (steamPath) {
    const steamMtga = path.join(
      steamPath,
      "steamapps",
      "common",
      "MTGA",
      "MTGA_Data",
      "Downloads",
      "Raw",
    )
    if (fs.existsSync(steamMtga)) return steamMtga
  }

  // Fall back to hardcoded defaults
  for (const p of MTGA_RAW_DATA_PATHS) {
    if (fs.existsSync(p)) return p
  }

  return null
}

export function getMtgaPlayerLogPath(): string {
  const injected = process.env.MTGA_PLAYER_LOG_PATH
  if (injected) return injected

  return path.resolve(
    app.getPath("appData"),
    "..\\LocalLow\\Wizards Of The Coast\\MTGA\\Player.log",
  )
}

export function getMtgaRawDataPath(): string | null {
  const injected = process.env.MTGA_RAW_DATA_PATH
  if (injected) return injected

  return findMtgaRawDataPath()
}
