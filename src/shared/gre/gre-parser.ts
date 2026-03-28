import { GreToClientEvent, TGreToClientEvent } from "./gre-types"

// ============================================================
// Parser
// ============================================================

export function parseLogLine(line: string): TGreToClientEvent | null {
  // Strip the UnityCrossThreadLogger prefix
  const jsonStart = line.indexOf("{")
  if (jsonStart === -1) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(line.slice(jsonStart))
  } catch {
    return null
  }

  // Only try to parse lines that look like GRE events
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("greToClientEvent" in parsed)
  ) {
    return null
  }

  const result = GreToClientEvent.safeParse(parsed)
  if (!result.success) {
    // Find which messages are failing
    const msgs = (parsed as any)?.greToClientEvent?.greToClientMessages ?? []
    msgs.forEach((msg: any, i: number) => {
      const t = msg?.type ?? "unknown"
      console.warn(
        `GRE parse error on message[${i}] type=${t}:`,
        JSON.stringify(result.error.flatten(), null, 2),
      )
    })
    return null
  }

  return result.data
}
