import { Button } from "@renderer/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select"
import { Textarea } from "@renderer/components/ui/textarea"
import { useProviderProfilesQuery } from "@renderer/features/provider-profiles/queries/provider-profiles-query"
import {
  useSelectedProviderProfileQuery,
  useSetSelectedProviderProfile,
} from "@renderer/features/provider-profiles/queries/selected-provider-profile-query"
import { ArrowUpIcon } from "lucide-react"
import { KeyboardEvent, useRef, useState } from "react"
import { useChatContext } from "./ChatProvider"

const LINE_HEIGHT = 24
const MAX_ROWS = 5

export function ChatPromptBar() {
  const { data: profiles = {} } = useProviderProfilesQuery()
  const { data: selectedProfileId } = useSelectedProviderProfileQuery()
  const { mutate: setSelectedProfile } = useSetSelectedProviderProfile()
  const { isLoading, sendMessage } = useChatContext()

  const sortedProfiles = Object.values(profiles).sort((a, b) =>
    (a.name ?? "untitled").localeCompare(b.name ?? "untitled"),
  )

  const [input, setInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
    await sendMessage(trimmed)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend().catch(console.error)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, LINE_HEIGHT * MAX_ROWS) + "px"
  }

  const canSend = !isLoading && !!input.trim()

  return (
    <div className="flex shrink-0 justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-3 flex flex-col gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask the coach..."
          rows={1}
          className="resize-none border-none p-0 shadow-none focus-visible:ring-0 focus-visible:border-none overflow-y-hidden min-h-0 field-sizing-normal"
          style={{ background: "transparent" }}
        />
        <div className="flex items-center justify-end gap-2">
          <Select
            value={selectedProfileId ?? ""}
            onValueChange={setSelectedProfile}
          >
            <SelectTrigger className="border-none bg-transparent shadow-none hover:bg-transparent focus:ring-0 pl-2 pr-1 h-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" side="top" align="end" sideOffset={4}>
              {sortedProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.name ?? "untitled"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="icon"
            onClick={() => handleSend().catch(console.error)}
            disabled={!canSend}
          >
            <ArrowUpIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
