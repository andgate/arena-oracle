import { Observable } from "rxjs"

export const IPlayerLogWatchService = Symbol("IPlayerLogWatchService")

export interface IPlayerLogWatchService {
  readonly log$: Observable<string>
}
