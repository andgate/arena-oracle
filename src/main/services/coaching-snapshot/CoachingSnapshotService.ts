import { CoachingSnapshot } from "@shared/coaching-types"
import { GameState } from "@shared/game-state-types"
import { BehaviorSubject, Subscription } from "rxjs"
import { inject, injectable, singleton } from "tsyringe"
import { IGameStateService } from "../game-state/GameStateService.interface"
import { IStoppable } from "../lifecycle"
import { ICoachingSnapshotService } from "./CoachingSnapshotService.interface"
import { ICoachingSnapshotTransform } from "./CoachingSnapshotTransform.interface"

@injectable()
@singleton()
export class CoachingSnapshotService
  implements ICoachingSnapshotService, IStoppable
{
  readonly snapshot$ = new BehaviorSubject<CoachingSnapshot | null>(null)

  private unsubscribeDecision: Subscription | null = null
  private unsubscribeGameReset: Subscription | null = null

  constructor(
    @inject(IGameStateService) gameStateService: IGameStateService,
    @inject(ICoachingSnapshotTransform) transform: ICoachingSnapshotTransform,
  ) {
    this.unsubscribeGameReset = gameStateService.gameReset$.subscribe(() => {
      this.snapshot$.next(null)
    })

    this.unsubscribeDecision = gameStateService.decisionRequired$.subscribe(
      (state: GameState) => this.snapshot$.next(transform.buildSnapshot(state)),
    )
  }

  stop() {
    this.unsubscribeDecision?.unsubscribe()
    this.unsubscribeDecision = null
    this.unsubscribeGameReset?.unsubscribe()
    this.unsubscribeGameReset = null
  }
}
