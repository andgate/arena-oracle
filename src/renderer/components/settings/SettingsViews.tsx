import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@renderer/components/ui/tabs"
import { GeneralSettingsView } from "./GeneralSettingsView"
import { ProfileSettingsView } from "./ProfileSettingsView"

export function SettingsViews() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <Tabs defaultValue="general" className="w-full max-w-lg">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettingsView />
        </TabsContent>

        <TabsContent value="providers">
          <ProfileSettingsView />
        </TabsContent>
      </Tabs>
    </div>
  )
}
