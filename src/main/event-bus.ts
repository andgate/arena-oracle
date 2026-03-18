import { GameState } from "@shared/game-state-types"
import { EventEmitter } from "./types/events"
import { CoachingSnapshot } from "@shared/coaching-types"

export const playerLogEvents = new EventEmitter<{
  chunk: string // chunks of text from player log
}>()

export const gameStateEvents = new EventEmitter<{
  stateUpdated: GameState // After each diff is applied
  decisionRequired: GameState // when player needs to make a decision
  gameReset: void
}>()

export const coachingEvents = new EventEmitter<{
  snapshotReady: CoachingSnapshot // current coaching snapshot
}>()
