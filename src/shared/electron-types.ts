import { ResolvedCard } from "./card-types"

export interface CardDbAPI {
  isLoaded: () => Promise<boolean>
  lookupCard: (grpId: number) => Promise<ResolvedCard | null>
}

export interface MTGAElectronAPI {
  cardDb: CardDbAPI
}

export interface IpcChannels {
  send: (channel: string, ...args: unknown[]) => void
  on: (channel: string, cb: (...args: any[]) => void) => void
  once: (channel: string, cb: (...args: any[]) => void) => void
  remove: (channel: string, cb: (...args: any[]) => void) => void
}
