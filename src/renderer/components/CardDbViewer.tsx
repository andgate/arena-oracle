import { useEffect, useState } from "react"
import { ResolvedCard } from "@shared/card-types"

export function CardDbViewer() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [grpId, setGrpId] = useState("93940") // Llanowar Elves as default
  const [card, setCard] = useState<ResolvedCard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.mtgaAPI.cardDb.isLoaded().then(setIsLoaded)
  }, [])

  async function handleLookup() {
    setError(null)
    setCard(null)
    const result = await window.mtgaAPI.cardDb.lookupCard(parseInt(grpId))
    if (!result) setError(`No card found for grpId ${grpId}`)
    else setCard(result)
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        Card DB status:{" "}
        <span style={{ color: isLoaded ? "lightgreen" : "salmon" }}>
          {isLoaded ? "Loaded" : "Not loaded"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={grpId}
          onChange={(e) => setGrpId(e.target.value)}
          placeholder="Enter grpId..."
          style={{ padding: "4px 8px", width: 160 }}
        />
        <button onClick={handleLookup} disabled={!isLoaded}>
          Lookup Card
        </button>
      </div>
      {error && <div style={{ color: "salmon" }}>{error}</div>}
      {card && (
        <div style={{ fontFamily: "monospace" }}>
          <div>
            <b>{card.name}</b> — {card.manaCost}
          </div>
          <div style={{ color: "#aaa" }}>
            {card.typeLine} {card.subtypeLine ? `— ${card.subtypeLine}` : ""}
          </div>
          <div>
            {card.power && card.toughness
              ? `${card.power}/${card.toughness}`
              : ""}
          </div>
          <div style={{ marginTop: 8 }}>
            {card.abilities.map((a, i) => (
              <div key={i} style={{ marginBottom: 4, fontSize: 13 }}>
                {a.text}
              </div>
            ))}
          </div>
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", color: "#aaa" }}>
              Raw JSON
            </summary>
            <pre style={{ fontSize: 11 }}>{JSON.stringify(card, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  )
}
