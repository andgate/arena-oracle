import "reflect-metadata"
import { container } from "tsyringe"
import { FileSystem } from "../utils/fs/FileSystem"
import { IFileSystem } from "../utils/fs/IFileSystem"
import { CardDbService } from "./card-db/CardDbService"
import { ICardDbService } from "./card-db/ICardDbService"
import { CoachingSnapshotService } from "./coaching-snapshot/CoachingSnapshotService"
import { ICoachingSnapshotService } from "./coaching-snapshot/ICoachingSnapshotService"
import { GameStateService } from "./game-state/GameStateService"
import { IGameStateService } from "./game-state/IGameStateService"
import { IStartable, IStoppable } from "./lifecycle"
import { IPlayerLogService } from "./player-log/IPlayerLogService"
import { PlayerLogService } from "./player-log/PlayerLogService"

// Bind interfaces to service implementations
container.register(IFileSystem, { useToken: FileSystem })
container.register(IPlayerLogService, { useToken: PlayerLogService })
container.register(IGameStateService, { useToken: GameStateService })
container.register(ICardDbService, { useToken: CardDbService })
container.register(ICoachingSnapshotService, {
  useToken: CoachingSnapshotService,
})

// Register startable and stoppable services
container.register(IStartable, { useToken: PlayerLogService })
container.register(IStoppable, { useToken: PlayerLogService })
container.register(IStoppable, { useToken: GameStateService })
container.register(IStoppable, { useToken: CoachingSnapshotService })
container.register(IStartable, { useToken: CardDbService })
container.register(IStoppable, { useToken: CardDbService })

export { container }
