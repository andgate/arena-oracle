import { GameState } from "./game-state-types"
import { CoachingSnapshot } from "./coaching-types"
import { ResolvedCard } from "./card-types"

export interface GameStateAPI {
  get: () => Promise<GameState>
  onStateUpdated: (callback: (state: GameState) => void) => void
  onDecisionRequired: (callback: (state: GameState) => void) => void
  removeListeners: () => void
}

export interface CardDbAPI {
  isLoaded: () => Promise<boolean>
  lookupCard: (grpId: number) => Promise<ResolvedCard | null>
}

export interface CoachingSnapshotAPI {
  get: () => Promise<CoachingSnapshot | null>
  onSnapshotReady: (
    callback: (snapshot: CoachingSnapshot) => void,
  ) => () => void
}

export interface MTGAElectronAPI {
  gameState: GameStateAPI
  cardDb: CardDbAPI
  coaching: CoachingSnapshotAPI
}

export interface IpcChannels {
  send: (channel: string, ...args: unknown[]) => void
  on: (channel: string, cb: (...args: any[]) => void) => void
  once: (channel: string, cb: (...args: any[]) => void) => void
  remove: (channel: string, cb: (...args: any[]) => void) => void
}