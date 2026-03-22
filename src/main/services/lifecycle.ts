export const IStartable = Symbol("IStartable")

export interface IStartable {
  start(): void
}

export const IStoppable = Symbol("IStoppable")

export interface IStoppable {
  stop(): void
}
