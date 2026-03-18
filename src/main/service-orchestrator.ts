import { closeCardDb, loadCardDb } from "./services/card-db-service"
import {
  startGameStateService,
  stopGameStateService,
} from "./services/game-state-service"
import {
  startCoachingSnapshotService,
  stopCoachingSnapshotService,
} from "./services/coaching-snapshot-service"
import {
  startPlayerLogWatcher,
  stopPlayerLogWatcher,
} from "./services/player-log-service"
import { findMtgaRawDataPath } from "./utils/mtga-data-utils"

export async function startPipeline() {
  const rawDataPath = findMtgaRawDataPath()
  if (!rawDataPath) throw new Error("Could not find MTGA raw data path")

  loadCardDb(rawDataPath) // sync, no deps
  startGameStateService() // registers on logEventBus
  startCoachingSnapshotService() // registers on gameStateEvents
  // startLlmService(win)                 // registers on coachingEvents, holds win ref
  startPlayerLogWatcher() // starts emitting — must be last
}

export async function stopPipeline() {
  stopPlayerLogWatcher() // stop the source first
  stopGameStateService()
  stopCoachingSnapshotService()
  // stopLlmService()
  closeCardDb()
}
