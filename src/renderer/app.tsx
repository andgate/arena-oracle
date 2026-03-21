import { createRoot } from "react-dom/client"
import { useState } from "react"
import "./styles.css"
import { PlayerLogViewer } from "./features/PlayerLogViewer"
import { GameStateViewer } from "./features/GameStateViewer"
import { CardDbViewer } from "./features/CardDbViewer"
import { CoachingViewer } from "./features/CoachingViewer"
import { ChatProvider } from "./features/chat/ChatProvider"
import { ChatViewer } from "./features/chat/ChatViewer"

const TABS = ["Raw Log", "Game State", "Card DB", "Coaching", "Chat"] as const
type Tab = (typeof TABS)[number]

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("Chat")

  return (
    <ChatProvider>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          maxWidth: "80%",
          margin: "0 auto",
          padding: 16,
          boxSizing: "border-box",
          fontFamily: "sans-serif",
          background: "#111",
          color: "#eee",
        }}
      >
        <h2 style={{ margin: "0 0 16px", flexShrink: 0 }}>
          MTGA Tracker - Dev
        </h2>

        {/* Tab bar */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            gap: 4,
            marginBottom: 16,
            borderBottom: "1px solid #333",
            paddingBottom: 8,
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "6px 14px",
                background: activeTab === tab ? "#333" : "transparent",
                border:
                  activeTab === tab
                    ? "1px solid #555"
                    : "1px solid transparent",
                borderRadius: 4,
                color: activeTab === tab ? "#fff" : "#888",
                cursor: "pointer",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {activeTab === "Chat" && <ChatViewer />}
          {activeTab === "Raw Log" && <PlayerLogViewer />}
          {activeTab === "Game State" && <GameStateViewer />}
          {activeTab === "Card DB" && <CardDbViewer />}
          {activeTab === "Coaching" && <CoachingViewer />}
        </div>
      </div>
    </ChatProvider>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
