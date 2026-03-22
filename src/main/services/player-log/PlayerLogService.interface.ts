import { Observable } from "rxjs"

export const IPlayerLogService = Symbol("IPlayerLogService")

export interface IPlayerLogService {
  readonly log$: Observable<string>
}