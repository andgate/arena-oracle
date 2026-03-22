import { coachingSnapshot$ } from "@renderer/streams"
import { CoachingSnapshot } from "@shared/coaching-types"
import { createContext, useContext, useEffect, useRef, useState } from "react"
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
  model: ChatModel
  setModel: (model: ChatModel) => void
  sendMessage: (content: string) => Promise<void>
}

// ============================================================
// Constants
// ============================================================

const CHAT_ENDPOINT = "https://andgate.unison-services.cloud/s/llm-service/chat"

const INITIAL_SYSTEM_MESSAGE: ChatMessage = {
  id: "system-0",
  role: "system",
  content: SYSTEM_PROMPT,
}

export type ChatModel = "groq" | "free"

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "openai/gpt-oss-120b"
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY

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

async function callFree(messages: ChatMessage[]): Promise<string> {
  const apiMessages = messages.map((m) => ({
    role: m.role === "snapshot" ? "user" : m.role,
    content: m.content,
  }))

  const response = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: apiMessages }),
  })

  if (!response.ok) {
    throw new Error(`Chat API error: ${response.status}`)
  }

  return response.text()
}

async function callGroq(messages: ChatMessage[]): Promise<string> {
  const apiMessages = messages.map((m) => ({
    role: m.role === "snapshot" ? "user" : m.role,
    content: m.content,
  }))

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: apiMessages,
      temperature: 1,
      max_completion_tokens: 8192,
      top_p: 1,
      stream: false,
    }),
  })

  if (!response.ok) throw new Error(`Groq API error: ${response.status}`)

  const data = await response.json()
  return data.choices[0].message.content
}

async function callChatApi(
  messages: ChatMessage[],
  model: ChatModel,
): Promise<string> {
  if (model === "groq") return callGroq(messages)
  return callFree(messages) // rename existing callChatApi body to callFree
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

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    INITIAL_SYSTEM_MESSAGE,
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [model, setModel] = useState<ChatModel>("groq")

  // Use a ref so the snapshot handler always sees the latest messages
  // without needing to be re-registered
  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // ---- LLM call ----
  const triggerLLM = async (newMessages: ChatMessage[]) => {
    setIsLoading(true)
    try {
      const content = await callChatApi(newMessages, model)
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      console.error("Chat API error:", err)
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "Sorry, I failed to get a response from the coach.",
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

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
      triggerLLM(updated)
    })

    return () => sub.unsubscribe()
  }, [])

  // ---- User message ----
  const sendMessage = async (content: string) => {
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
      value={{ messages, isLoading, model, setModel, sendMessage }}
    >
      {children}
    </ChatContext.Provider>
  )
}
