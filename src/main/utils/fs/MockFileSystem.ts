import type { ReadStream, Stats } from "fs"
import { createFsFromVolume, Volume } from "memfs"
import type { IFileSystem } from "./FileSystem.interface"

export class MockFileSystem implements IFileSystem {
  private vol: InstanceType<typeof Volume>
  private fs: ReturnType<typeof createFsFromVolume>

  constructor(initialFiles: Record<string, string> = {}) {
    this.vol = Volume.fromJSON(initialFiles)
    this.fs = createFsFromVolume(this.vol)
  }

  readFileSync(path: string, encoding: BufferEncoding): string {
    return this.fs.readFileSync(path, encoding) as string
  }

  statSync(path: string): { size: number } {
    return this.fs.statSync(path) as { size: number }
  }

  watchFile(
    path: string,
    options: { interval: number },
    listener: (curr: Stats, prev: Stats) => void,
  ): void {
    this.fs.watchFile(path, options, listener as any)
  }

  unwatchFile(path: string): void {
    this.fs.unwatchFile(path)
  }

  createReadStream(
    path: string,
    options: { start: number; end?: number; encoding: BufferEncoding },
  ): ReadStream {
    return this.fs.createReadStream(path, options) as unknown as ReadStream
  }

  existsSync(path: string): boolean {
    return this.fs.existsSync(path)
  }

  writeFileSync(path: string, data: string): void {
    const dir = path.substring(0, path.lastIndexOf("/"))
    if (dir) this.vol.mkdirSync(dir, { recursive: true })
    this.fs.writeFileSync(path, data)
  }

  // Test helper: write new content and manually trigger watchFile listeners
  triggerFileChange(path: string, newContent: string): void {
    const prev = this.vol.statSync(path)
    this.vol.writeFileSync(path, newContent)
    const curr = this.vol.statSync(path)
    // memfs stores listeners internally — tickle them manually
    ;(this.fs as any).watchFile.__listeners?.[path]?.(curr, prev)
  }
}
