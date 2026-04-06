import { AppLayout } from "@renderer/app/layout"
import { AppSidebar, type AppView } from "@renderer/components/app-sidebar"
import { ChatProvider } from "@renderer/components/chat/ChatProvider"
import { ChatViewer } from "@renderer/components/chat/ChatViewer"
import { ProviderOnboardingView } from "@renderer/components/onboarding/ProviderOnboardingView"
import { SettingsViews } from "@renderer/components/settings/SettingsViews"
import { ProvidersProvider, useProviders } from "@renderer/hooks/use-providers"
import { SettingsProvider, useSettings } from "@renderer/hooks/use-settings"
import { type ReactNode, useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import "../styles/globals.css"

const HISTORY_SESSIONS = [
  { id: "goo-145", title: "Retrieve GOO-145 from Linear" },
  { id: "shadcn-sidebar", title: "Shadcn component library selection" },
  { id: "desktop-ui", title: "Best UI library for desktop apps" },
  { id: "goo-97", title: "Fix GOO-97 formatting issue" },
  { id: "goo-147", title: "Retrieve GOO-147 from Linear" },
  { id: "arena-backlog", title: "Arena Oracle backlog issues" },
  { id: "goo-142", title: "Retrieve GOO-142 from Linear" },
] as const

function PlaceholderView({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-xl rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-sm">
        <div className="text-[0.7rem] font-medium tracking-[0.22em] text-muted-foreground uppercase">
          {eyebrow}
        </div>
        <h2 className="mt-3 text-2xl font-semibold">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  )
}

function ChatRoute() {
  const { isLoading, profiles, selectedProfileId } = useProviders()
  const hasProfiles = Object.keys(profiles).length > 0

  if (isLoading) {
    return (
      <PlaceholderView
        eyebrow="Chat"
        title="Loading providers"
        description="Arena Oracle is checking your saved provider profiles."
      />
    )
  }

  if (!hasProfiles) {
    return <ProviderOnboardingView />
  }

  if (selectedProfileId === null) {
    return (
      <PlaceholderView
        eyebrow="Chat"
        title="Loading chat"
        description="Arena Oracle is restoring your selected provider profile."
      />
    )
  }

  return (
    <div className="min-h-0 flex-1">
      <ChatViewer />
    </div>
  )
}

function AppContent({
  activeView,
  selectedHistoryId,
}: {
  activeView: AppView
  selectedHistoryId: string | null
}) {
  if (activeView === "chat") {
    return <ChatRoute />
  }

  if (activeView === "history") {
    const selectedSession = HISTORY_SESSIONS.find(
      (session) => session.id === selectedHistoryId,
    )

    return (
      <PlaceholderView
        eyebrow="History"
        title={selectedSession?.title ?? "Session history"}
        description={
          selectedSession
            ? "History session details will land in a follow-up story. The shell is wired so the sidebar can already target specific sessions."
            : "A dedicated history view will live here. The sidebar list is scrollable and already supports selecting individual sessions."
        }
      />
    )
  }

  if (activeView === "settings") return <SettingsViews />

  return (
    <PlaceholderView
      eyebrow="Debug"
      title="Debug tools"
      description="Debug remains hidden until developer mode is wired up."
    />
  )
}

function getViewTitle(activeView: AppView, selectedHistoryId: string | null) {
  if (activeView === "settings") return "Settings"
  if (activeView === "history" && selectedHistoryId !== null) return "History"
  if (activeView === "history") return "History"
  if (activeView === "debug") return "Debug"
  return "Arena Oracle"
}

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <ProvidersProvider>
        <ChatProvider>{children}</ChatProvider>
      </ProvidersProvider>
    </SettingsProvider>
  )
}

function AppShell() {
  const { settings } = useSettings()
  const [activeView, setActiveView] = useState<AppView>("chat")
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null,
  )
  const debugEnabled = settings?.developerMode ?? false

  useEffect(() => {
    if (!debugEnabled && activeView === "debug") {
      setActiveView("chat")
    }
  }, [activeView, debugEnabled])

  const handleSelectCurrentSession = () => {
    setSelectedHistoryId(null)
    setActiveView("chat")
  }

  const handleSelectHistoryView = () => {
    setSelectedHistoryId(null)
    setActiveView("history")
  }

  const handleSelectHistorySession = (sessionId: string) => {
    setSelectedHistoryId(sessionId)
    setActiveView("history")
  }

  const handleSelectSettings = () => {
    setSelectedHistoryId(null)
    setActiveView("settings")
  }

  const handleSelectView = (view: AppView) => {
    switch (view) {
      case "chat":
        handleSelectCurrentSession()
        break
      case "history":
        handleSelectHistoryView()
        break
      case "settings":
        handleSelectSettings()
        break
      default:
        setSelectedHistoryId(null)
        setActiveView(view)
        break
    }
  }

  return (
    <AppLayout
      title={getViewTitle(activeView, selectedHistoryId)}
      sidebar={
        <AppSidebar
          activeView={activeView}
          historySessions={[...HISTORY_SESSIONS]}
          selectedHistoryId={selectedHistoryId}
          onSelectHistorySession={handleSelectHistorySession}
          onSelectView={handleSelectView}
        />
      }
    >
      <AppContent
        activeView={activeView}
        selectedHistoryId={selectedHistoryId}
      />
    </AppLayout>
  )
}

function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  )
}

document.documentElement.classList.add("dark")

createRoot(document.getElementById("root")!).render(<App />)
