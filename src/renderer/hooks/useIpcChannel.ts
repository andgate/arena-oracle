import { Observable } from "rxjs"

export function fromIpcChannel<T>(channel: string): Observable<T> {
  return new Observable<T>((subscriber) => {
    console.log(`[ipc] subscribing to ${channel}`)
    window.channels.send(`${channel}:subscribe`)

    const onNext = (value: T) => {
      console.log(`[ipc] received ${channel}:next`)
      subscriber.next(value)
    }
    const onError = (err: { message: string }) =>
      subscriber.error(new Error(err.message))
    const onComplete = () => subscriber.complete()

    window.channels.on(`${channel}:next`, onNext)
    window.channels.on(`${channel}:error`, onError)
    window.channels.once(`${channel}:complete`, onComplete)

    return () => {
      window.channels.send(`${channel}:unsubscribe`)
      window.channels.remove(`${channel}:next`, onNext)
      window.channels.remove(`${channel}:error`, onError)
      window.channels.remove(`${channel}:complete`, onComplete)
    }
  })
}