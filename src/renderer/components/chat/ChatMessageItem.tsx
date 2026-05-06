import { Badge } from "@renderer/components/ui/badge"
import { cn } from "@renderer/lib/utils"

interface ChatMessageItemProps {
  role: "user" | "assistant"
  content: string
}

export function ChatMessageItem({ role, content }: ChatMessageItemProps) {
  const isUser = role === "user"

  return (
    <div
      className={cn("mb-3 flex flex-col", isUser ? "items-end" : "items-start")}
    >
      <Badge variant="secondary" className="mb-0.5 text-[10px] px-1.5 py-0">
        {isUser ? "Player" : "Coach"}
      </Badge>
      <div
        className={cn(
          "max-w-[80%] px-3 py-2 rounded-md text-[13px] leading-relaxed whitespace-pre-wrap border border-border",
          isUser ? "bg-muted" : "bg-card",
        )}
      >
        {content}
      </div>
    </div>
  )
}
