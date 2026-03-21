import "reflect-metadata"
import { container } from "tsyringe"
import { IFileSystem } from "../utils/fs/IFileSystem"
import { FileSystem } from "../utils/fs/FileSystem"
import { IPlayerLogService } from "./player-log/IPlayerLogService"
import { PlayerLogService } from "./player-log/PlayerLogService"
import { IStartable, IStoppable } from "./lifecycle"

// Bind interfaces to service implementations
container.register(IFileSystem, { useToken: FileSystem })
container.register(IPlayerLogService, { useToken: PlayerLogService })

// Register startable and stoppable services
container.register(IStartable, { useToken: PlayerLogService })
container.register(IStoppable, { useToken: PlayerLogService })

export { container }