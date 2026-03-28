import { parseLogLine } from "@shared/gre/gre-parser"
import { readFileSync } from "fs"
import path from "path"
import { test as baseTest, describe, expect } from "vitest"
import { TGREMessage, TMulliganReq } from "./gre-types"

// Setup test fixtures
type Fixture = (name: string) => string

const test = baseTest.extend<{ fixture: Fixture }>({
  fixture: [
    async ({}, use: (fn: (name: string) => string) => Promise<void>) => {
      await use((name: string) =>
        readFileSync(
          path.resolve(import.meta.dirname, `__fixtures__/${name}`),
          "utf-8",
        ).trimEnd(),
      )
    },
    { scope: "file" },
  ],
})

// ============================================================
// Helpers
// ============================================================

function findMessage<T extends TGREMessage>(
  messages: TGREMessage[],
  type: T["type"],
): T {
  const msg = messages.find((m) => m.type === type)
  if (!msg)
    throw new Error(`Expected message of type ${type} not found in batch`)
  return msg as T
}

// ============================================================
// Null / rejection cases
// ============================================================

describe("parseLogLine — null cases", () => {
  test("returns null for an empty string", () => {
    expect(parseLogLine("")).toBeNull()
  })

  test("returns null for a plain log line with no JSON", () => {
    expect(
      parseLogLine(
        "[UnityCrossThreadLogger]Initialize engine version: 2021.3.14f1",
      ),
    ).toBeNull()
  })

  test("returns null for a line with no opening brace", () => {
    expect(parseLogLine("no brace here at all")).toBeNull()
  })

  test("returns null for malformed JSON after the brace", () => {
    expect(parseLogLine("prefix { not valid json :::")).toBeNull()
  })

  test("returns null for valid JSON that is missing greToClientEvent", () => {
    expect(parseLogLine('{"someOtherKey": 123}')).toBeNull()
  })

  test("returns null for valid JSON with greToClientEvent but wrong shape", () => {
    expect(
      parseLogLine('{"greToClientEvent": {"notTheRightKey": []}}'),
    ).toBeNull()
  })
})

// ============================================================
// Valid fixture cases — golden snapshots
// ============================================================

describe("parseLogLine — known message types", () => {
  test("parses GREMessageType_GameStateMessage", ({ fixture }) => {
    const result = parseLogLine(fixture("game-state-message.log"))
    expect(result).not.toBeNull()
    expect(result).toMatchSnapshot()
  })

  test("parses GREMessageType_ActionsAvailableReq", ({ fixture }) => {
    const result = parseLogLine(fixture("actions-available-req.log"))
    expect(result).not.toBeNull()
    expect(result).toMatchSnapshot()
  })

  test("parses GREMessageType_DeclareAttackersReq", ({ fixture }) => {
    const result = parseLogLine(fixture("declare-attackers-req.log"))
    expect(result).not.toBeNull()
    expect(result).toMatchSnapshot()
  })

  test("parses GREMessageType_DeclareBlockersReq", ({ fixture }) => {
    const result = parseLogLine(fixture("declare-blockers-req.log"))
    expect(result).not.toBeNull()
    expect(result).toMatchSnapshot()
  })

  test("parses GREMessageType_SelectTargetsReq", ({ fixture }) => {
    const result = parseLogLine(fixture("select-targets-req.log"))
    expect(result).not.toBeNull()
    expect(result).toMatchSnapshot()
  })

  test("parses GREMessageType_AssignDamageReq", ({ fixture }) => {
    const result = parseLogLine(fixture("assign-damage-req.log"))
    expect(result).not.toBeNull()
    expect(result).toMatchSnapshot()
  })

  test("parses GREMessageType_ConnectResp (with DieRollResultsResp and initial GameStateMessage batch)", ({
    fixture,
  }) => {
    const result = parseLogLine(fixture("connect-resp.log"))
    expect(result).not.toBeNull()
    expect(result).toMatchSnapshot()
  })

  test("parses GREMessageType_MulliganReq — first offer (no mulliganCount)", ({
    fixture,
  }) => {
    const result = parseLogLine(fixture("mulligan-req.log"))
    expect(result).not.toBeNull()
    // Confirm mulliganCount is absent on first offer
    const msgs = result!.greToClientEvent.greToClientMessages
    const mulliganMsg = findMessage<TMulliganReq>(
      msgs as TGREMessage[],
      "GREMessageType_MulliganReq",
    )
    expect(mulliganMsg).toBeDefined()
    expect(mulliganMsg.mulliganReq.mulliganCount).toBeUndefined()
    expect(result).toMatchSnapshot()
  })

  test("parses GREMessageType_GroupReq (LondonMulligan bottom selection)", ({
    fixture,
  }) => {
    const result = parseLogLine(fixture("group-req.log"))
    expect(result).not.toBeNull()
    expect(result).toMatchSnapshot()
  })
})

// ============================================================
// Unknown message type passthrough
// ============================================================

describe("parseLogLine — unknown message types", () => {
  test("passes through CastingTimeOptionsReq as UnknownMessage without failing", ({
    fixture,
  }) => {
    const result = parseLogLine(fixture("casting-time-options-req.log"))
    expect(result).not.toBeNull()
    // The unknown message should be present in the batch with its type preserved
    const msgs = result!.greToClientEvent.greToClientMessages
    const unknown = msgs.find(
      (m) => m.type === "GREMessageType_CastingTimeOptionsReq",
    )
    expect(unknown).toBeDefined()
    expect(unknown?.type).toBe("GREMessageType_CastingTimeOptionsReq")
    expect(result).toMatchSnapshot()
  })

  test("passes through PromptReq in a mixed batch without failing", ({
    fixture,
  }) => {
    // mulligan-req.log contains a PromptReq alongside MulliganReq
    const result = parseLogLine(fixture("mulligan-req.log"))
    expect(result).not.toBeNull()
    const msgs = result!.greToClientEvent.greToClientMessages
    const promptMsg = msgs.find((m) => m.type === "GREMessageType_PromptReq")
    expect(promptMsg).toBeDefined()
  })
})

// ============================================================
// Mixed batch
// ============================================================

describe("parseLogLine — mixed batch", () => {
  test("parses a batch containing multiple GameStateMessages followed by ActionsAvailableReq", ({
    fixture,
  }) => {
    const result = parseLogLine(fixture("mixed-batch.log"))
    expect(result).not.toBeNull()
    const msgs = result!.greToClientEvent.greToClientMessages
    const types = msgs.map((m) => m.type)
    expect(types).toContain("GREMessageType_GameStateMessage")
    expect(types).toContain("GREMessageType_ActionsAvailableReq")
    expect(result).toMatchSnapshot()
  })
})

// ============================================================
// Missing optional fields
// ============================================================

describe("parseLogLine — missing optional fields", () => {
  test("parses a GameStateMessage diff where turnInfo is absent", () => {
    // game-state-message.log gsId=2 has turnInfo present but minimal —
    // construct a minimal valid line without it
    const minimal = {
      transactionId: "test",
      requestId: 1,
      timestamp: "2024-01-01T00:00:00.000Z",
      greToClientEvent: {
        greToClientMessages: [
          {
            type: "GREMessageType_GameStateMessage",
            systemSeatIds: [1],
            msgId: 1,
            gameStateId: 1,
            gameStateMessage: {
              type: "GameStateType_Diff",
              gameStateId: 1,
              // no turnInfo, no zones, no gameObjects — all optional
            },
          },
        ],
      },
    }
    const result = parseLogLine("prefix " + JSON.stringify(minimal))
    expect(result).not.toBeNull()
  })

  test("parses a MulliganReq where mulliganCount is absent (first offer)", () => {
    const minimal = {
      transactionId: "test",
      requestId: 1,
      timestamp: "2024-01-01T00:00:00.000Z",
      greToClientEvent: {
        greToClientMessages: [
          {
            type: "GREMessageType_MulliganReq",
            systemSeatIds: [1],
            msgId: 1,
            gameStateId: 1,
            mulliganReq: {
              mulliganType: "MulliganType_London",
              // mulliganCount intentionally absent
            },
          },
        ],
      },
    }
    const result = parseLogLine("prefix " + JSON.stringify(minimal))
    expect(result).not.toBeNull()
    const msg = findMessage<TMulliganReq>(
      result!.greToClientEvent.greToClientMessages as TGREMessage[],
      "GREMessageType_MulliganReq",
    )
    expect(msg.mulliganReq.mulliganCount).toBeUndefined()
  })
})

// ============================================================
// Rejection cases
// ============================================================

describe("parseLogLine — rejection cases", () => {
  test("returns null and warns for a GRE event that fails Zod validation", () => {
    const invalid = {
      transactionId: 999, // z.string() will reject this
      requestId: 1,
      timestamp: "2024-01-01T00:00:00.000Z",
      greToClientEvent: {
        greToClientMessages: [
          { type: "GREMessageType_GameStateMessage" }, // at least one message
          { noTypeField: true }, // covers the ?? "unknown" fallback
        ],
      },
    }
    const result = parseLogLine("prefix " + JSON.stringify(invalid))
    expect(result).toBeNull()
  })
})
