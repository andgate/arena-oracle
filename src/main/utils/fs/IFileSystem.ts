import type { FSWatcher, ReadStream, Stats } from "fs"

export const IFileSystem = Symbol("IFileSystem")

export interface IFileSystem {
  readFileSync(path: string, encoding: BufferEncoding): string
  statSync(path: string): { size: number }
  watch(path: string): FSWatcher
  watchFile(
    path: string,
    options: { interval: number },
    listener: (curr: Stats, prev: Stats) => void,
  ): void
  unwatchFile(path: string): void
  createReadStream(
    path: string,
    options: { start: number; end?: number; encoding: BufferEncoding },
  ): ReadStream
  existsSync(path: string): boolean
  writeFileSync(path: string, data: string): void
}
