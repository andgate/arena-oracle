import { IStartable, IStoppable } from "@main/services/lifecycle"
import { getMtgaPlayerLogPath } from "@main/utils/mtga-paths"
import { ReplaySubject } from "rxjs"
import { inject, injectable, singleton } from "tsyringe"
import { IFileSystem } from "../../utils/fs/FileSystem.interface"
import { IPlayerLogWatchService } from "./PlayerLogWatchService.interface"

export const LOG_WATCH_INTERVAL_MS = 500

@injectable()
@singleton()
export class PlayerLogWatchService
  implements IPlayerLogWatchService, IStartable, IStoppable
{
  readonly log$ = new ReplaySubject<string>(100)

  private logPath: string = ""
  private fileOffset: number = 0
  private chunkCount = 0

  constructor(@inject(IFileSystem) private fs: IFileSystem) {
    this.logPath = getMtgaPlayerLogPath()
  }

  start() {
    // Ensure logfile exists
    if (!this.fs.existsSync(this.logPath)) {
      this.fs.writeFileSync(this.logPath, "")
    }

    // Set to 0 to read entire existing log, or stat.size to tail only
    this.fileOffset = 0
    this.chunkCount = 0

    // Emit initial file content
    try {
      const stat = this.fs.statSync(this.logPath)
      const stream = this.fs.createReadStream(this.logPath, {
        start: 0,
        end: stat.size - 1,
        encoding: "utf-8",
      })
      stream.on("data", (chunk) => {
        this.chunkCount += 1
        this.log$.next(chunk as string)
      })
      stream.on("end", () => {
        this.fileOffset = stat.size
      })
    } catch (e) {
      console.error("Could not read initial log file:", e)
    }

    // Watch for changes
    this.fs.watchFile(
      this.logPath,
      { interval: LOG_WATCH_INTERVAL_MS },
      (curr, prev) => {
        if (curr.size === prev.size) return
        if (curr.size < prev.size) this.fileOffset = 0 // truncated or rotated

        // Read only the new bytes
        const stream = this.fs.createReadStream(this.logPath, {
          start: this.fileOffset,
          end: curr.size - 1,
          encoding: "utf-8",
        })

        stream.on("data", (chunk) => {
          this.chunkCount += 1
          this.log$.next(chunk as string)
        })
        stream.on("end", () => {
          this.fileOffset = curr.size
        })
      },
    )
  }

  stop() {
    this.fs.unwatchFile(this.logPath)
  }
}
