import { app } from "electron"
import fs from "fs"
import path from "path"
import { playerLogEvents } from "../event-bus"

let fileOffset = 0
let accumulatedLog = ""

const PLAYER_LOG_FILEPATH = path.resolve(
  app.getPath("appData"),
  "..\\LocalLow\\Wizards Of The Coast\\MTGA\\Player.log",
)

function emitChunk(chunk: string) {
  accumulatedLog += chunk
  playerLogEvents.emit("chunk", chunk)
}

export function getAccumulatedLog(): string {
  return accumulatedLog
}

export function startPlayerLogWatcher() {
  // Set to 0 to read entire existing log, or stat.size to tail only
  fileOffset = 0
  accumulatedLog = ""

  // Emit initial file content
  try {
    const stat = fs.statSync(PLAYER_LOG_FILEPATH)
    const stream = fs.createReadStream(PLAYER_LOG_FILEPATH, {
      start: 0,
      end: stat.size - 1,
      encoding: "utf-8",
    })
    stream.on("data", (chunk) => emitChunk(chunk as string))
    stream.on("end", () => {
      fileOffset = stat.size
    })
  } catch (e) {
    console.error("Could not read initial log file:", e)
  }

  // Watch for changes
  fs.watchFile(PLAYER_LOG_FILEPATH, { interval: 500 }, (curr, prev) => {
    if (curr.size === prev.size) return
    if (curr.size < prev.size) fileOffset = 0 // truncated or rotated

    // Read only the new bytes
    const stream = fs.createReadStream(PLAYER_LOG_FILEPATH, {
      start: fileOffset,
      end: curr.size - 1,
      encoding: "utf-8",
    })

    stream.on("data", (chunk) => emitChunk(chunk as string))
    stream.on("end", () => {
      fileOffset = curr.size
    })
  })
}

export function stopPlayerLogWatcher() {
  fs.unwatchFile(PLAYER_LOG_FILEPATH)
}
