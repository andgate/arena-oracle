import { useEffect, useRef, useState } from "react"
import { useChatContext } from "./ChatProvider"
import { ChatModel } from "./llm-providers"

export function ChatViewer() {
  const { messages, isLoading, model, setModel, sendMessage } = useChatContext()
  const [input, setInput] = useState("")
  const [revealedSnapshots, setRevealedSnapshots] = useState<Set<string>>(
    new Set(),
  )
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    setInput("")
    await sendMessage(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleSnapshot = (id: string) => {
    setRevealedSnapshots((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleMessages = messages.filter((m) => m.role !== "system")

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Message list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 8 }}>
        {visibleMessages.map((m) => {
          if (m.role === "snapshot") {
            const revealed = revealedSnapshots.has(m.id)
            return (
              <div key={m.id} style={{ marginBottom: 8 }}>
                <button
                  onClick={() => toggleSnapshot(m.id)}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    cursor: "pointer",
                    background: "transparent",
                    border: "1px solid #444",
                    borderRadius: 4,
                    color: "#666",
                  }}
                >
                  {revealed ? "Hide game state" : "Show game state"}
                </button>
                {revealed && (
                  <pre
                    style={{
                      marginTop: 4,
                      padding: "6px 10px",
                      background: "#1a1a1a",
                      border: "1px solid #333",
                      borderRadius: 4,
                      fontSize: 11,
                      color: "#666",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.content}
                  </pre>
                )}
              </div>
            )
          }

          const isUser = m.role === "user"
          return (
            <div
              key={m.id}
              style={{
                marginBottom: 12,
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#555",
                  marginBottom: 2,
                }}
              >
                {isUser ? "You" : "Coach"}
              </div>
              <div
                style={{
                  maxWidth: "80%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: isUser ? "#1a3a2a" : "#1e1e1e",
                  border: `1px solid ${isUser ? "#2a5a3a" : "#333"}`,
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            </div>
          )
        })}

        {isLoading && (
          <div style={{ color: "#555", fontSize: 12, padding: "4px 0" }}>
            Coach is thinking...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid #333",
          padding: 8,
          display: "flex",
          gap: 8,
        }}
      >
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as ChatModel)}
          style={{
            padding: "0 8px",
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 4,
            color: "#eee",
            fontSize: 13,
          }}
        >
          <option value="groq">Groq</option>
          <option value="free">Free</option>
        </select>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the coach... (Enter to send, Shift+Enter for newline)"
          rows={2}
          style={{
            flex: 1,
            padding: "6px 8px",
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 4,
            color: "#eee",
            fontSize: 13,
            resize: "none",
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          style={{
            padding: "0 16px",
            background: isLoading || !input.trim() ? "#222" : "#1a3a2a",
            border: "1px solid #333",
            borderRadius: 4,
            color: isLoading || !input.trim() ? "#555" : "#eee",
            cursor: isLoading || !input.trim() ? "default" : "pointer",
            fontSize: 13,
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
