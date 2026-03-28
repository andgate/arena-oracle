import { TGreToClientEvent } from "@shared/gre/gre-types"
import { Observable } from "rxjs"

export const IPlayerLogParserService = Symbol("IPlayerLogParserService")

export interface IPlayerLogParserService {
  readonly events$: Observable<TGreToClientEvent>
}
