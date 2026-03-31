import { useEffect, useState } from "react"
import ScrollableFeed from "react-scrollable-feed"
import { playerLog$ } from "../../streams"

export function PlayerLogViewer() {
  const [playerLog, setPlayerLog] = useState<string>("")

  // Watch for and collect new log chunks
  useEffect(() => {
    const sub = playerLog$.subscribe((log) => {
      if (!log) return
      setPlayerLog(log)
    })
    return () => sub.unsubscribe()
  }, [])

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Log output */}
      <ScrollableFeed>
        {playerLog.length == 0 && (
          <span style={{ color: "#666" }}>Waiting for log output...</span>
        )}
        <div
          style={{
            fontFamily: "monospace",
            fontSize: "0.85rem",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {playerLog}
        </div>
      </ScrollableFeed>
    </div>
  )
}
