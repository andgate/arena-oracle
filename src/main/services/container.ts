import "reflect-metadata"
import { container } from "tsyringe"
import { IFileSystem } from "../utils/fs/IFileSystem"
import { FileSystem } from "../utils/fs/FileSystem"
import { IPlayerLogService } from "./player-log/IPlayerLogService"
import { PlayerLogService } from "./player-log/PlayerLogService"
import { IStartable, IStoppable } from "./lifecycle"

// Bind interfacecs to implementation
container.register(IFileSystem, { useClass: FileSystem })
container.register(IPlayerLogService, { useClass: PlayerLogService })

// Register startable and stoppable services
container.register(IStartable, { useClass: PlayerLogService })
container.register(IStoppable, { useClass: PlayerLogService })

export { container }