import { getLanguageModelForProfile } from "@renderer/lib/ai"
import { coachingSnapshot$ } from "@renderer/streams"
import { useProviderProfilesQuery } from "@renderer/features/provider-profiles/queries/provider-profiles-query"
import { useSelectedProviderProfileQuery } from "@renderer/features/provider-profiles/queries/selected-provider-profile-query"
import { CoachingSnapshot } from "@shared/coaching-types"
import { ModelMessage, streamText } from "ai"
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import SYSTEM_PROMPT from "./coaching-prompt.md"

// ============================================================
// Types
// ============================================================

export type MessageRole = "system" | "user" | "assistant" | "snapshot"

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  snapshot?: CoachingSnapshot
}

interface ChatContextValue {
  messages: ChatMessage[]
  isLoading: boolean
  errorMessage: string | null
  dismissError: () => void
  sendMessage: (content: string) => Promise<void>
}

// ============================================================
// Constants
// ============================================================

const INITIAL_SYSTEM_MESSAGE: ChatMessage = {
  id: "system-0",
  role: "system",
  content: SYSTEM_PROMPT,
}

// ============================================================
// LLM Helpers
// ============================================================

function toApiMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages.map((m) => ({
    role: m.role === "snapshot" ? "user" : m.role,
    content: m.content,
  }))
}

// ============================================================
// Helpers
// ============================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function snapshotToText(snapshot: CoachingSnapshot): string {
  const lines: string[] = []

  lines.push(`=== GAME STATE UPDATE ===`)
  lines.push(
    `Turn ${snapshot.turnNumber} — ${snapshot.phase}${snapshot.step ? ` / ${snapshot.step}` : ""} — ${snapshot.isLocalPlayerTurn ? "Your turn" : "Opponent's turn"}`,
  )
  lines.push(``)

  lines.push(
    `You: ${snapshot.localPlayer.lifeTotal} life | Library: ${snapshot.localPlayer.librarySize}`,
  )
  lines.push(
    `Opponent: ${snapshot.opponent.lifeTotal} life | Library: ${snapshot.opponent.librarySize} | Hand: ${snapshot.opponent.handSize} cards`,
  )
  lines.push(``)

  if (snapshot.localPlayer.battlefield.length > 0) {
    lines.push(`Your battlefield:`)
    for (const c of snapshot.localPlayer.battlefield) {
      const parts = [`  - ${c.name}`]
      if (c.power) parts.push(`(${c.power}/${c.toughness})`)
      if (c.isTapped) parts.push(`[Tapped]`)
      if (c.hasSummoningSickness) parts.push(`[Sick]`)
      if (c.isAttacking) parts.push(`[Attacking]`)
      lines.push(parts.join(" "))
    }
    lines.push(``)
  }

  if (snapshot.localPlayer.hand.length > 0) {
    lines.push(`Your hand:`)
    for (const c of snapshot.localPlayer.hand) {
      const parts = [`  - ${c.name} ${c.manaCost}`]
      if (c.canCast) parts.push(`[Can Cast]`)
      if (c.canPlay) parts.push(`[Can Play]`)
      lines.push(parts.join(" "))
    }
    lines.push(``)
  }

  if (snapshot.opponent.battlefield.length > 0) {
    lines.push(`Opponent's battlefield:`)
    for (const c of snapshot.opponent.battlefield) {
      const parts = [`  - ${c.name}`]
      if (c.power) parts.push(`(${c.power}/${c.toughness})`)
      if (c.isTapped) parts.push(`[Tapped]`)
      if (c.isAttacking) parts.push(`[Attacking]`)
      lines.push(parts.join(" "))
    }
    lines.push(``)
  }

  if (snapshot.stack.length > 0) {
    lines.push(`Stack (top first):`)
    for (const e of snapshot.stack) {
      lines.push(
        `  - ${e.name} (${e.controlledByLocalPlayer ? "you" : "opponent"})`,
      )
    }
    lines.push(``)
  }

  if (snapshot.localPlayer.graveyard.length > 0) {
    lines.push(
      `Your graveyard: ${snapshot.localPlayer.graveyard.map((c) => c.name).join(", ")}`,
    )
  }
  if (snapshot.opponent.graveyard.length > 0) {
    lines.push(
      `Opponent graveyard: ${snapshot.opponent.graveyard.map((c) => c.name).join(", ")}`,
    )
  }

  lines.push(``)
  lines.push(`Decision required: ${snapshot.decision.type}`)

  switch (snapshot.decision.type) {
    case "ActionsAvailable":
      lines.push(`Available actions:`)
      for (const a of snapshot.decision.actions) {
        lines.push(`  - ${a}`)
      }
      break
    case "DeclareAttackers":
      lines.push(`Eligible attackers:`)
      for (const a of snapshot.decision.eligibleAttackers) {
        lines.push(`  - ${a.name} (${a.power}/${a.toughness})`)
      }
      break
    case "DeclareBlockers":
      lines.push(`Eligible blockers:`)
      for (const b of snapshot.decision.eligibleBlockers) {
        lines.push(
          `  - ${b.name} can block: ${b.attackers.map((a) => a.name).join(", ")}`,
        )
      }
      break
    case "SelectTargets":
      lines.push(`Select targets for ${snapshot.decision.sourceName}`)
      break
    case "PayCosts":
      lines.push(`Pay cost: ${snapshot.decision.cost}`)
      break
    case "AssignDamage":
      lines.push(`Assign damage`)
      break
    case "Mulligan":
      lines.push(
        `Mulligan decision (count: ${snapshot.decision.mulliganCount}):`,
      )
      for (const c of snapshot.decision.cards) {
        lines.push(`  - ${c}`)
      }
      break
    case "LondonMulliganGroup":
      lines.push(`Choose ${snapshot.decision.keepCount} cards to keep:`)
      for (const c of snapshot.decision.cards) {
        lines.push(`  - ${c}`)
      }
      break
  }

  return lines.join("\n")
}

// ============================================================
// Context
// ============================================================

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider")
  return ctx
}

// ============================================================
// Provider
// ============================================================

export function ChatProvider({ children }: { children: ReactNode }) {
  const { data: profiles = {} } = useProviderProfilesQuery()
  const { data: selectedProfileId } = useSelectedProviderProfileQuery()
  const selectedProfile = selectedProfileId
    ? (profiles[selectedProfileId] ?? null)
    : null
  const [messages, setMessages] = useState<ChatMessage[]>([
    INITIAL_SYSTEM_MESSAGE,
  ])
  const [incomingMessage, setIncomingMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const visibleMessages: ChatMessage[] = useMemo(() => {
    if (incomingMessage === null) return messages
    return [
      ...messages,
      { id: "incoming", role: "assistant" as const, content: incomingMessage },
    ]
  }, [messages, incomingMessage])

  // Use a ref so the snapshot handler always sees the latest messages
  // without needing to be re-registered
  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const selectedProfileRef = useRef(selectedProfile)
  useEffect(() => {
    selectedProfileRef.current = selectedProfile
  }, [selectedProfile])

  // ---- LLM call ----
  const triggerLLM = async (newMessages: ChatMessage[]) => {
    const activeProfile = selectedProfileRef.current

    if (!activeProfile) {
      return
    }

    setIsLoading(true)
    setIncomingMessage("")

    try {
      const model = await getLanguageModelForProfile(activeProfile)
      const result = streamText({
        model,
        messages: toApiMessages(newMessages),
      })

      let content = ""
      for await (const delta of result.textStream) {
        content += delta
        setIncomingMessage(content)
      }

      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: "assistant", content },
      ])
    } catch (err) {
      console.error("Chat API error:", err)
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to get a response from the coach.",
      )
    } finally {
      setIncomingMessage(null)
      setIsLoading(false)
    }
  }

  const dismissError = () => setErrorMessage(null)

  // ---- Snapshot listener ----
  useEffect(() => {
    const sub = coachingSnapshot$.subscribe((snapshot) => {
      if (!snapshot) return
      const snapshotMsg: ChatMessage = {
        id: generateId(),
        role: "snapshot",
        content: snapshotToText(snapshot),
        snapshot,
      }
      const updated = [...messagesRef.current, snapshotMsg]
      setMessages(updated)
      triggerLLM(updated).catch(console.error)
    })

    return () => sub.unsubscribe()
  }, [])

  // ---- User message ----
  const sendMessage = async (content: string) => {
    if (!selectedProfileRef.current) {
      return
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content,
    }
    const updated = [...messagesRef.current, userMsg]
    setMessages(updated)
    await triggerLLM(updated)
  }

  return (
    <ChatContext.Provider
      value={{
        messages: visibleMessages,
        isLoading,
        errorMessage,
        dismissError,
        sendMessage,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}
