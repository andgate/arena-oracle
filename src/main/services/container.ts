import "reflect-metadata"
import { container } from "tsyringe"
import { FileSystem } from "../utils/fs/FileSystem"
import { IFileSystem } from "../utils/fs/FileSystem.interface"
import { CardDbService } from "./card-db/CardDbService"
import { ICardDbService } from "./card-db/CardDbService.interface"
import { CoachingSnapshotService } from "./coaching-snapshot/CoachingSnapshotService"
import { ICoachingSnapshotService } from "./coaching-snapshot/CoachingSnapshotService.interface"
import { GameStateService } from "./game-state/GameStateService"
import { IGameStateService } from "./game-state/GameStateService.interface"
import { IStartable, IStoppable } from "./lifecycle"
import { PlayerLogWatchService } from "./player-log-watch/PlayerLogWatchService"
import { IPlayerLogWatchService } from "./player-log-watch/PlayerLogWatchService.interface"

// Bind interfaces to service implementations
container.register(IFileSystem, { useToken: FileSystem })
container.register(IPlayerLogWatchService, { useToken: PlayerLogWatchService })
container.register(IGameStateService, { useToken: GameStateService })
container.register(ICardDbService, { useToken: CardDbService })
container.register(ICoachingSnapshotService, {
  useToken: CoachingSnapshotService,
})

// Register startable and stoppable services
container.register(IStartable, { useToken: PlayerLogWatchService })
container.register(IStoppable, { useToken: PlayerLogWatchService })
container.register(IStoppable, { useToken: GameStateService })
container.register(IStoppable, { useToken: CoachingSnapshotService })
container.register(IStartable, { useToken: CardDbService })
container.register(IStoppable, { useToken: CardDbService })

export { container }
