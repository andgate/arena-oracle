import "reflect-metadata"
import { container } from "tsyringe"
import { FileSystem } from "../utils/fs/FileSystem"
import { IFileSystem } from "../utils/fs/FileSystem.interface"
import { CardDbService } from "./card-db/CardDbService"
import { ICardDbService } from "./card-db/CardDbService.interface"
import { CoachingSnapshotService } from "./coaching-snapshot/CoachingSnapshotService"
import { ICoachingSnapshotService } from "./coaching-snapshot/CoachingSnapshotService.interface"
import { CoachingSnapshotTransform } from "./coaching-snapshot/CoachingSnapshotTransform"
import { ICoachingSnapshotTransform } from "./coaching-snapshot/CoachingSnapshotTransform.interface"
import { GameStateReducer } from "./game-state/GameStateReducer"
import { IGameStateReducer } from "./game-state/GameStateReducer.interface"
import { GameStateService } from "./game-state/GameStateService"
import { IGameStateService } from "./game-state/GameStateService.interface"
import { IStartable, IStoppable } from "./lifecycle"
import { PlayerLogParserService } from "./player-log-parser/PlayerLogParserService"
import { IPlayerLogParserService } from "./player-log-parser/PlayerLogParserService.interface"
import { PlayerLogWatchService } from "./player-log-watch/PlayerLogWatchService"
import { IPlayerLogWatchService } from "./player-log-watch/PlayerLogWatchService.interface"
import { SettingsService } from "./settings/SettingsService"
import { ISettingsService } from "./settings/SettingsService.interface"
import { StoreService } from "./store/StoreService"
import { IStoreService } from "./store/StoreService.interface"

// Bind interfaces to service implementations
container.register(IFileSystem, { useToken: FileSystem })
container.register(IPlayerLogWatchService, { useToken: PlayerLogWatchService })
container.register(IPlayerLogParserService, {
  useToken: PlayerLogParserService,
})
container.register(IGameStateReducer, { useToken: GameStateReducer })
container.register(IGameStateService, { useToken: GameStateService })
container.register(ICardDbService, { useToken: CardDbService })
container.register(ICoachingSnapshotTransform, {
  useToken: CoachingSnapshotTransform,
})
container.register(ICoachingSnapshotService, {
  useToken: CoachingSnapshotService,
})
container.register(IStoreService, { useToken: StoreService })
container.register(ISettingsService, { useToken: SettingsService })

// Register startable and stoppable services
container.register(IStartable, { useToken: PlayerLogWatchService })
container.register(IStoppable, { useToken: PlayerLogWatchService })
container.register(IStoppable, { useToken: GameStateService })
container.register(IStoppable, { useToken: CoachingSnapshotService })
container.register(IStartable, { useToken: CardDbService })
container.register(IStoppable, { useToken: CardDbService })

export { container }
