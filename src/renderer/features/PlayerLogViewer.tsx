import { useEffect, useRef, useState } from "react"

export interface PlayerLogViewerProps {
  log: string
}

export function PlayerLogViewer({}: PlayerLogViewerProps) {
  const [playerLog, setPlayerLog] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)

  // Watch for and collect new log chunks
  useEffect(() => {
    // Fetch everything accumulated so far
    window.mtgaAPI.playerLog.getLog().then((log) => {
      setPlayerLog(log)
    })

    // Then stream new chunks as they arrive
    window.mtgaAPI.playerLog.onChunk((chunk: string) => {
      setPlayerLog((prev) => prev + chunk)
    })

    return () => window.mtgaAPI.playerLog.removeListeners()
  }, [])

  // Handle auto scroll
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" })
    }
  }, [playerLog, autoScroll])

  // Detect user scrolling up — disable auto-scroll
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      if (userScrolledRef.current) return

      const { scrollTop, scrollHeight, clientHeight } = container
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50

      if (!isAtBottom) {
        userScrolledRef.current = true
        setAutoScroll(false)
        // Reset the flag after the event settles so future scrolls are detected
        setTimeout(() => {
          userScrolledRef.current = false
        }, 100)
      }
    }

    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  if (error) return <div>Error: {error}</div>

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar */}
      <div
        style={{
          padding: "6px 8px",
          borderBottom: "1px solid #333",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          onClick={() => setAutoScroll((prev) => !prev)}
          style={{
            padding: "3px 10px",
            fontSize: "0.8rem",
            cursor: "pointer",
            background: autoScroll ? "#2a6" : "#555",
            color: "#fff",
            border: "none",
            borderRadius: 4,
          }}
        >
          {autoScroll ? "⏬ Following" : "⏸ Follow"}
        </button>
      </div>

      {/* Log output */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 8,
        }}
      >
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
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
