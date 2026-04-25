import { ProviderProfileSettingsForm } from "@renderer/components/provider-profiles-settings/ProviderProfileSettingsForm"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@renderer/components/ui/card"
import { ProviderProfileSettingsProvider } from "@renderer/features/provider-profiles/hooks/use-provider-profile-settings"

export function ProfileSettingsView() {
  return (
    <Card className="overflow-visible">
      <CardHeader>
        <div>
          <CardTitle>Providers</CardTitle>
          <CardDescription>
            Manage saved provider profiles for chat.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <ProviderProfileSettingsProvider>
          <ProviderProfileSettingsForm />
        </ProviderProfileSettingsProvider>
      </CardContent>
    </Card>
  )
}
