import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@renderer/components/ui/alert-dialog"
import { useEffect, useRef, useState } from "react"
import { useChatContext } from "./ChatProvider"
import { ChatInputBar } from "./ChatInputBar"

export function ChatViewer() {
  const { dismissError, errorMessage, messages, isLoading } = useChatContext()
  const [revealedSnapshots, setRevealedSnapshots] = useState<Set<string>>(
    new Set(),
  )
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
    <div className="flex flex-col h-full">
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

      <ChatInputBar />

      <AlertDialog
        open={errorMessage !== null}
        onOpenChange={(open) => {
          if (!open) dismissError()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chat unavailable</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={dismissError}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
