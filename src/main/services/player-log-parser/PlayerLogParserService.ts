import { IPlayerLogWatchService } from "@main/services/player-log-watch/PlayerLogWatchService.interface"
import { parseLogLine } from "@shared/gre/gre-parser"
import { TGreToClientEvent } from "@shared/gre/gre-types"
import { mergeMap, Observable } from "rxjs"
import { inject, injectable, singleton } from "tsyringe"
import { IPlayerLogParserService } from "./PlayerLogParserService.interface"

@injectable()
@singleton()
export class PlayerLogParserService implements IPlayerLogParserService {
  // NOTE: Assumes every chunk ends with '\n' — MTGA flushes complete lines
  // and the OS delivers them as such. If violated due to a read/write race,
  // the last line of the affected chunk will be silently dropped. If game
  // state updates appear to be occasionally missed, start here.
  readonly events$: Observable<TGreToClientEvent>

  constructor(
    @inject(IPlayerLogWatchService) watchService: IPlayerLogWatchService,
  ) {
    this.events$ = watchService.log$.pipe(
      mergeMap((chunk) => chunk.split("\n")),
      mergeMap((line) => {
        const event = parseLogLine(line)
        return event ? [event] : []
      }),
    )
  }
}
