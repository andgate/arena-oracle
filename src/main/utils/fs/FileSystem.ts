import * as fs from "fs"
import { injectable, singleton } from "tsyringe"
import { IFileSystem } from "./IFileSystem"

@singleton()
@injectable()
export class FileSystem implements IFileSystem {
  readFileSync(path: string, encoding: BufferEncoding): string {
    return fs.readFileSync(path, encoding)
  }

  statSync(path: string): { size: number } {
    return fs.statSync(path)
  }

  watch(path: string): fs.FSWatcher {
    return fs.watch(path)
  }

  watchFile(
    path: string,
    options: { interval: number },
    listener: (curr: fs.Stats, prev: fs.Stats) => void,
  ): void {
    fs.watchFile(path, options, listener)
  }

  unwatchFile(path: string): void {
    fs.unwatchFile(path)
  }

  createReadStream(
    path: string,
    options: { start: number; end?: number; encoding: BufferEncoding },
  ): fs.ReadStream {
    return fs.createReadStream(path, options)
  }

  existsSync(path: string): boolean {
    return fs.existsSync(path)
  }

  writeFileSync(path: string, data: string): void {
    fs.writeFileSync(path, data)
  }
}