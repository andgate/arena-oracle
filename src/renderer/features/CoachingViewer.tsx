import {
  BattlefieldCard,
  CoachingSnapshot,
  Decision,
  HandCard,
} from "@shared/coaching-types"
import { useEffect, useState } from "react"
import { coachingSnapshot$ } from "../streams"

// ============================================================
// Card views
// ============================================================

function BattlefieldCardView({ card }: { card: BattlefieldCard }) {
  return (
    <div
      style={{
        border: "1px solid #444",
        borderRadius: 4,
        padding: "6px 10px",
        marginBottom: 4,
        opacity: card.isTapped ? 0.6 : 1,
      }}
    >
      <div>
        <b>{card.name}</b> {card.manaCost}
        {card.isTapped && (
          <span style={{ color: "salmon", marginLeft: 8 }}>[Tapped]</span>
        )}
        {card.hasSummoningSickness && (
          <span style={{ color: "#aaa", marginLeft: 8 }}>[Sick]</span>
        )}
        {card.isAttacking && (
          <span style={{ color: "salmon", marginLeft: 8 }}>[Attacking]</span>
        )}
      </div>
      <div style={{ color: "#aaa", fontSize: 12 }}>
        {card.typeLine}
        {card.subtypeLine ? ` — ${card.subtypeLine}` : ""}
        {card.power ? `  ${card.power}/${card.toughness}` : ""}
      </div>
    </div>
  )
}

function HandCardView({ card }: { card: HandCard }) {
  return (
    <div
      style={{
        border: `1px solid ${card.canCast || card.canPlay ? "#4a8" : "#444"}`,
        borderRadius: 4,
        padding: "6px 10px",
        marginBottom: 4,
      }}
    >
      <div>
        <b>{card.name}</b> {card.manaCost}
        {card.canCast && (
          <span style={{ color: "lightgreen", marginLeft: 8 }}>[Can Cast]</span>
        )}
        {card.canPlay && (
          <span style={{ color: "lightblue", marginLeft: 8 }}>[Can Play]</span>
        )}
      </div>
      <div style={{ color: "#aaa", fontSize: 12 }}>
        {card.typeLine}
        {card.subtypeLine ? ` — ${card.subtypeLine}` : ""}
      </div>
    </div>
  )
}

// ============================================================
// Decision view
// ============================================================

function DecisionView({ decision }: { decision: Decision }) {
  const sectionLabel = (text: string) => (
    <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>{text}</div>
  )

  const row = (content: string, key: number) => (
    <div
      key={key}
      style={{
        padding: "4px 8px",
        background: "#1a2a1a",
        marginBottom: 2,
        borderRadius: 4,
        fontSize: 13,
      }}
    >
      {content}
    </div>
  )

  const cardPill = (
    name: string,
    power: string,
    toughness: string,
    key: number,
  ) => (
    <div
      key={key}
      style={{
        display: "inline-block",
        border: "1px solid #555",
        borderRadius: 4,
        padding: "2px 8px",
        marginRight: 6,
        marginBottom: 4,
        fontSize: 13,
      }}
    >
      {name} {power && toughness ? `(${power}/${toughness})` : ""}
    </div>
  )

  switch (decision.type) {
    case "ActionsAvailable":
      return (
        <div>
          {sectionLabel("AVAILABLE ACTIONS")}
          {decision.actions.map((a, i) => row(a, i))}
        </div>
      )

    case "DeclareAttackers":
      return (
        <div>
          {sectionLabel("DECLARE ATTACKERS — choose which creatures attack")}
          {decision.eligibleAttackers.length === 0 ? (
            <div style={{ color: "#555" }}>No eligible attackers</div>
          ) : (
            decision.eligibleAttackers.map((a, i) =>
              cardPill(a.name, a.power, a.toughness, i),
            )
          )}
        </div>
      )

    case "DeclareBlockers":
      return (
        <div>
          {sectionLabel("DECLARE BLOCKERS — choose which creatures block")}
          {decision.eligibleBlockers.map((b, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #444",
                borderRadius: 4,
                padding: "6px 10px",
                marginBottom: 6,
              }}
            >
              <div style={{ fontSize: 13 }}>
                <b>{b.name}</b> ({b.power}/{b.toughness}) can block:
              </div>
              <div style={{ marginTop: 4, paddingLeft: 12 }}>
                {b.attackers.map((a, j) => (
                  <div key={j} style={{ color: "salmon", fontSize: 12 }}>
                    ↳ {a.name} ({a.power}/{a.toughness})
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )

    case "SelectTargets":
      return (
        <div>
          {sectionLabel(`SELECT TARGETS — for ${decision.sourceName}`)}
          {decision.targetSlots.map((slot, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>
                Slot {slot.targetIdx} — pick {slot.minTargets}
                {slot.minTargets !== slot.maxTargets
                  ? `–${slot.maxTargets}`
                  : ""}
                :
              </div>
              {slot.options.map((t, j) => (
                <div
                  key={j}
                  style={{
                    padding: "3px 8px",
                    background: "#1a1a2a",
                    borderRadius: 4,
                    marginBottom: 2,
                    fontSize: 13,
                  }}
                >
                  {t.name}
                </div>
              ))}
            </div>
          ))}
        </div>
      )

    case "PayCosts":
      return (
        <div>
          {sectionLabel(`PAY COSTS — ${decision.cost}`)}
          {decision.paymentOptions.map((opt, i) => row(opt, i))}
        </div>
      )

    case "AssignDamage":
      return (
        <div>
          {sectionLabel("ASSIGN DAMAGE")}
          {decision.damageAssigners.map((d, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #444",
                borderRadius: 4,
                padding: "6px 10px",
                marginBottom: 6,
              }}
            >
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                <b>{d.attackerName}</b> — {d.totalDamage} total damage
              </div>
              {d.assignments.map((a, j) => (
                <div
                  key={j}
                  style={{ fontSize: 12, color: "#aaa", paddingLeft: 12 }}
                >
                  ↳ {a.targetName}: {a.assignedDamage} dmg
                  {a.minDamage !== a.maxDamage
                    ? ` (min ${a.minDamage} / max ${a.maxDamage})`
                    : ""}
                </div>
              ))}
            </div>
          ))}
        </div>
      )

    case "Mulligan":
      return (
        <div>
          {sectionLabel(
            decision.mulliganCount === 0
              ? "OPENING HAND — Keep or Mulligan?"
              : `MULLIGAN #${decision.mulliganCount} — Keep or Mulligan?`,
          )}
          {decision.cards.map((name, i) => row(name, i))}
        </div>
      )

    case "LondonMulliganGroup":
      return (
        <div>
          {sectionLabel(
            `LONDON MULLIGAN — Choose ${decision.keepCount} cards to keep (put the rest on the bottom)`,
          )}
          {decision.cards.map((name, i) => row(name, i))}
        </div>
      )
  }
}

// ============================================================
// Main viewer
// ============================================================

export function CoachingViewer() {
  const [snapshot, setSnapshot] = useState<CoachingSnapshot | null>(null)
  const [updateCount, setUpdateCount] = useState(0)

  useEffect(() => {
    const sub = coachingSnapshot$.subscribe((s) => {
      setSnapshot(s)
      setUpdateCount((c) => c + 1)
    })

    return () => sub.unsubscribe()
  }, [])

  if (!snapshot) {
    return <div style={{ color: "#666" }}>Waiting for coaching snapshot...</div>
  }

  const { localPlayer, opponent } = snapshot

  return (
    <div style={{ fontFamily: "sans-serif", fontSize: 14 }}>
      <div style={{ marginBottom: 8, color: "#aaa", fontSize: 12 }}>
        Snapshots received: {updateCount}
      </div>

      {/* Turn info */}
      <div
        style={{
          marginBottom: 16,
          padding: "8px 12px",
          background: "#222",
          borderRadius: 4,
        }}
      >
        <b>Turn {snapshot.turnNumber}</b> — {snapshot.phase}
        {snapshot.step ? ` / ${snapshot.step}` : ""}
        {snapshot.isLocalPlayerTurn ? (
          <span style={{ color: "lightgreen", marginLeft: 12 }}>Your turn</span>
        ) : (
          <span style={{ color: "salmon", marginLeft: 12 }}>
            Opponent's turn
          </span>
        )}
      </div>

      {/* Players */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* Local player */}
        <div>
          <h3 style={{ margin: "0 0 8px" }}>
            You — ❤️ {localPlayer.lifeTotal}
          </h3>
          <div style={{ marginBottom: 8 }}>
            <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>
              BATTLEFIELD
            </div>
            {localPlayer.battlefield.length === 0 ? (
              <div style={{ color: "#555" }}>Empty</div>
            ) : (
              localPlayer.battlefield.map((c, i) => (
                <BattlefieldCardView key={i} card={c} />
              ))
            )}
          </div>
          <div>
            <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>
              HAND ({localPlayer.handSize})
            </div>
            {localPlayer.hand.map((c) => (
              <HandCardView key={c.instanceId} card={c} />
            ))}
          </div>
          {localPlayer.revealed.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>
                REVEALED
              </div>
              {localPlayer.revealed.map((c) => (
                <BattlefieldCardView key={c.instanceId} card={c} />
              ))}
            </div>
          )}
          {localPlayer.graveyard.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>
                GRAVEYARD
              </div>
              {localPlayer.graveyard.map((c) => (
                <BattlefieldCardView key={c.instanceId} card={c} />
              ))}
            </div>
          )}
          {localPlayer.exile.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>
                EXILE
              </div>
              {localPlayer.exile.map((c) => (
                <BattlefieldCardView key={c.instanceId} card={c} />
              ))}
            </div>
          )}
          <div style={{ color: "#aaa", fontSize: 12, marginTop: 8 }}>
            Library: {localPlayer.librarySize}
          </div>
        </div>

        {/* Opponent */}
        <div>
          <h3 style={{ margin: "0 0 8px" }}>
            Opponent — ❤️ {opponent.lifeTotal}
          </h3>
          <div style={{ marginBottom: 8 }}>
            <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>
              BATTLEFIELD
            </div>
            {opponent.battlefield.length === 0 ? (
              <div style={{ color: "#555" }}>Empty</div>
            ) : (
              opponent.battlefield.map((c) => (
                <BattlefieldCardView key={c.instanceId} card={c} />
              ))
            )}
          </div>
          <div>
            <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>
              HAND ({opponent.handSize} cards — hidden)
            </div>
          </div>
          {opponent.revealed.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>
                REVEALED
              </div>
              {opponent.revealed.map((c) => (
                <BattlefieldCardView key={c.instanceId} card={c} />
              ))}
            </div>
          )}
          {opponent.graveyard.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>
                GRAVEYARD
              </div>
              {opponent.graveyard.map((c) => (
                <BattlefieldCardView key={c.instanceId} card={c} />
              ))}
            </div>
          )}
          {opponent.exile.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>
                EXILE
              </div>
              {opponent.exile.map((c) => (
                <BattlefieldCardView key={c.instanceId} card={c} />
              ))}
            </div>
          )}
          <div style={{ color: "#aaa", fontSize: 12, marginTop: 8 }}>
            Library: {opponent.librarySize}
          </div>
        </div>
      </div>

      {/* Stack */}
      {snapshot.stack.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>
            STACK (top first)
          </div>
          {snapshot.stack.map((e) => (
            <div
              key={e.instanceId}
              style={{
                padding: "4px 8px",
                background: "#2a2a2a",
                marginBottom: 2,
                borderRadius: 4,
              }}
            >
              {e.name} {e.manaCost}
              {e.controlledByLocalPlayer ? (
                <span style={{ color: "lightgreen", marginLeft: 8 }}>
                  (you)
                </span>
              ) : (
                <span style={{ color: "salmon", marginLeft: 8 }}>
                  (opponent)
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Decision */}
      <DecisionView decision={snapshot.decision} />
    </div>
  )
}
