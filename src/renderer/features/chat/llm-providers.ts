import { createGroq } from "@ai-sdk/groq"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { LanguageModel } from "ai"

export type ChatModel = "groq" | "free"

export const groq = createGroq({ apiKey: import.meta.env.VITE_GROQ_API_KEY })
export const openrouter = createOpenRouter({
  apiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
})

const models: Record<ChatModel, LanguageModel> = {
  groq: groq("openai/gpt-oss-120b"),
  free: openrouter.chat("openrouter/free"),
}

export function getModel(model: ChatModel): LanguageModel {
  return models[model]
}
