import "reflect-metadata"
import { container } from "tsyringe"
import { FileSystem } from "../utils/fs/FileSystem"
import { IFileSystem } from "../utils/fs/IFileSystem"
import { GameStateService } from "./game-state/GameStateService"
import { IGameStateService } from "./game-state/IGameStateService"
import { IStartable, IStoppable } from "./lifecycle"
import { IPlayerLogService } from "./player-log/IPlayerLogService"
import { PlayerLogService } from "./player-log/PlayerLogService"

// Bind interfaces to service implementations
container.register(IFileSystem, { useToken: FileSystem })
container.register(IPlayerLogService, { useToken: PlayerLogService })
container.register(IGameStateService, { useToken: GameStateService })

// Register startable and stoppable services
container.register(IStartable, { useToken: PlayerLogService })
container.register(IStoppable, { useToken: PlayerLogService })

export { container }
