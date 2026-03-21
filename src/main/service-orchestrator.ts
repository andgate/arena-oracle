import { closeCardDb, loadCardDb } from "./services/card-db/CardDbService"
import {
  startCoachingSnapshotService,
  stopCoachingSnapshotService,
} from "./services/coaching-snapshot/CoachingSnapshotService"
import { findMtgaRawDataPath } from "./utils/mtga-data-utils"

export async function startPipeline() {
  const rawDataPath = findMtgaRawDataPath()
  if (!rawDataPath) throw new Error("Could not find MTGA raw data path")

  loadCardDb(rawDataPath) // sync, no deps
  startCoachingSnapshotService() // registers on gameStateEvents
  // startLlmService(win)                 // registers on coachingEvents, holds win ref
}

export async function stopPipeline() {
  stopCoachingSnapshotService()
  // stopLlmService()
  closeCardDb()
}
