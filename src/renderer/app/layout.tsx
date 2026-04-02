import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@renderer/components/ui/sidebar"
import { TooltipProvider } from "@renderer/components/ui/tooltip"
import type { ReactNode } from "react"

type AppLayoutProps = {
  children: ReactNode
  sidebar: ReactNode
  title: string
}

export function AppLayout({ children, sidebar, title }: AppLayoutProps) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        {sidebar}
        <SidebarInset className="min-h-svh">
          <header className="flex h-14 items-center gap-3 border-b border-border px-4 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <div className="min-w-0 text-sm font-medium tracking-[0.08em] text-foreground uppercase">
              {title}
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
