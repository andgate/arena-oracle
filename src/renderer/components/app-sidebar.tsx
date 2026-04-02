import {
  Clock3,
  Cog,
  MessageSquare,
  Menu,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@renderer/components/ui/button"
import { useSettings } from "@renderer/hooks/use-settings"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@renderer/components/ui/sidebar"

export type AppView = "chat" | "history" | "settings" | "debug"

export type HistorySession = {
  id: string
  title: string
}

type AppSidebarProps = {
  activeView: AppView
  historySessions: HistorySession[]
  selectedHistoryId: string | null
  onSelectHistorySession: (sessionId: string) => void
  onSelectView: (view: AppView) => void
}

type SidebarNavItemProps = {
  icon: LucideIcon
  label: string
  isActive?: boolean
  onClick: () => void
}

function SidebarNavItem({
  icon: Icon,
  label,
  isActive = false,
  onClick,
}: SidebarNavItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} onClick={onClick}>
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function AppSidebar({
  activeView,
  historySessions,
  selectedHistoryId,
  onSelectHistorySession,
  onSelectView,
}: AppSidebarProps) {
  const { settings } = useSettings()
  const { isMobile, state, toggleSidebar } = useSidebar()
  const debugEnabled = settings?.developerMode ?? false
  const showExpandedSections = isMobile || state === "expanded"

  const handleSidebarSelection = (callback: () => void) => {
    callback()
    if (isMobile) toggleSidebar()
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="gap-1 p-3">
        <SidebarMenu className="hidden md:flex">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleSidebar}
              tooltip="Toggle sidebar"
              className="h-10"
            >
              <Menu />
              <span>Arena Oracle</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center justify-between md:hidden">
          <div className="text-sm font-medium tracking-[0.08em] text-sidebar-foreground uppercase">
            Arena Oracle
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground"
            onClick={toggleSidebar}
            aria-label="Close sidebar"
          >
            <X />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 pb-2">
        <SidebarMenu>
          <SidebarNavItem
            icon={MessageSquare}
            label="Current"
            isActive={activeView === "chat"}
            onClick={() => handleSidebarSelection(() => onSelectView("chat"))}
          />
        </SidebarMenu>

        {showExpandedSections && (
          <>
            <SidebarSeparator className="my-3" />

            <div className="px-2 pb-2 text-[0.7rem] font-medium tracking-[0.18em] text-sidebar-foreground/55 uppercase">
              History
            </div>

            <SidebarMenu>
              <SidebarNavItem
                icon={Clock3}
                label="All sessions"
                isActive={activeView === "history" && selectedHistoryId === null}
                onClick={() => handleSidebarSelection(() => onSelectView("history"))}
              />
              {historySessions.map((session) => (
                <SidebarMenuItem key={session.id}>
                  <SidebarMenuButton
                    isActive={
                      activeView === "history" &&
                      selectedHistoryId === session.id
                    }
                    className="pl-8"
                    onClick={() =>
                      handleSidebarSelection(() =>
                        onSelectHistorySession(session.id),
                      )
                    }
                  >
                    <span>{session.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          {debugEnabled && (
            <SidebarNavItem
              icon={Wrench}
              label="Debug"
              isActive={activeView === "debug"}
              onClick={() => handleSidebarSelection(() => onSelectView("debug"))}
            />
          )}
          <SidebarNavItem
            icon={Cog}
            label="Settings"
            isActive={activeView === "settings"}
            onClick={() => handleSidebarSelection(() => onSelectView("settings"))}
          />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
