import { CoachingSnapshot } from "@shared/coaching-types"
import { Observable } from "rxjs"

export const ICoachingSnapshotService = Symbol("ICoachingSnapshotService")

export interface ICoachingSnapshotService {
  snapshot$: Observable<CoachingSnapshot | null>
}
