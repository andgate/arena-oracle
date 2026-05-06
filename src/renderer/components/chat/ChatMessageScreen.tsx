import { ScrollArea } from "@renderer/components/ui/scroll-area"
import { Spinner } from "@renderer/components/ui/spinner"
import { useEffect, useRef } from "react"
import { ChatMessageItem } from "./ChatMessageItem"
import { ChatMessage, MessageRole, useChatContext } from "./ChatProvider"
import { ChatSnapshotMessage } from "./ChatSnapshotMessage"

type VisibleMessage = ChatMessage & { role: Exclude<MessageRole, "system"> }

export function ChatMessageScreen() {
  const { messages, isLoading } = useChatContext()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const visibleMessages = messages.filter(
    (m): m is VisibleMessage => m.role !== "system",
  )

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="mx-auto max-w-2xl p-4">
        {visibleMessages.map((m) => {
          if (m.role === "snapshot") {
            return <ChatSnapshotMessage key={m.id} content={m.content} />
          }
          return <ChatMessageItem key={m.id} role={m.role} content={m.content} />
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs py-1">
            <Spinner className="size-3" />
            <span>Coach is thinking...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
