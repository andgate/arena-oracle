import { CoachingSnapshot } from "@shared/coaching-types"
import { GameState } from "@shared/game-state-types"

export const ICoachingSnapshotTransform = Symbol("ICoachingSnapshotTransform")

export interface ICoachingSnapshotTransform {
  buildSnapshot(state: GameState): CoachingSnapshot | null
}
