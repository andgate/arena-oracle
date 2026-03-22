import { GameState } from "@shared/game-state-types"
import { useEffect, useState } from "react"
import { gameState$ } from "../streams"

export function GameStateViewer() {
  const [state, setState] = useState<GameState | null>(null)
  const [updateCount, setUpdateCount] = useState(0)

  useEffect(() => {
    const sub = gameState$.subscribe((s) => {
      setState(s)
      setUpdateCount((c) => c + 1)
    })

    return () => sub.unsubscribe()
  }, [])

  if (!state)
    return <div style={{ color: "#666" }}>Waiting for game state...</div>

  return (
    <div>
      <div style={{ marginBottom: 8, color: "#aaa", fontSize: 12 }}>
        Updates received: {updateCount}
      </div>
      <pre style={{ fontSize: 11, overflow: "auto", maxHeight: 600 }}>
        {JSON.stringify(state, null, 2)}
      </pre>
    </div>
  )
}
