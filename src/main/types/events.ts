import { EventEmitter as BaseEventEmitter } from "events"

export class EventEmitter<TEvents extends Record<string, unknown>> {
  private emitter = new BaseEventEmitter()

  on<K extends keyof TEvents>(event: K, listener: (data: TEvents[K]) => void) {
    this.emitter.on(event as string, listener)
    return () => this.emitter.off(event as string, listener) // returns unsubscribe fn
  }

  emit<K extends keyof TEvents>(event: K, data: TEvents[K]) {
    this.emitter.emit(event as string, data)
  }
}
