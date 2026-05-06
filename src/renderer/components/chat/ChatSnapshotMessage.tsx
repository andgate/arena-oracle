import { Button } from "@renderer/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@renderer/components/ui/collapsible"
import { useState } from "react"

interface ChatSnapshotMessageProps {
  content: string
}

export function ChatSnapshotMessage({ content }: ChatSnapshotMessageProps) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-2">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="xs">
          {open ? "Hide game state" : "Show game state"}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-1 px-2.5 py-1.5 bg-card border border-border rounded text-[11px] text-muted-foreground whitespace-pre-wrap">
          {content}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}
