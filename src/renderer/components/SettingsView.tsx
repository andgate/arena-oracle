import { useState } from "react"

import { Card, CardContent } from "@renderer/components/ui/card"
import { Switch } from "@renderer/components/ui/switch"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@renderer/components/ui/tabs"
import { useSettings } from "@renderer/hooks/use-settings"

type SettingFieldProps = {
  checked: boolean
  description: string
  disabled?: boolean
  label: string
  onCheckedChange: (checked: boolean) => void | Promise<void>
}

function SettingField({
  checked,
  description,
  disabled = false,
  label,
  onCheckedChange,
}: SettingFieldProps) {
  return (
    <label className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium text-card-foreground">{label}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </label>
  )
}

export function SettingsView() {
  const { error, isLoading, settings, setAlwaysOnTop, setDeveloperMode } =
    useSettings()
  const [pendingSetting, setPendingSetting] = useState<
    "alwaysOnTop" | "developerMode" | null
  >(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const handleSettingChange = async (
    settingKey: "alwaysOnTop" | "developerMode",
    value: boolean,
  ) => {
    setPendingSetting(settingKey)
    setUpdateError(null)

    try {
      if (settingKey === "alwaysOnTop") {
        await setAlwaysOnTop(value)
      } else {
        await setDeveloperMode(value)
      }
    } catch (nextError) {
      setUpdateError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to update settings.",
      )
    } finally {
      setPendingSetting(null)
    }
  }

  const isDisabled = isLoading || settings === null

  return (
    <div className="h-full overflow-y-auto p-6">
      <Tabs defaultValue="general" className="w-full max-w-lg">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardContent className="space-y-4 pt-4 text-sm text-muted-foreground">
              <SettingField
                label="Always on top"
                description="Keep Arena Oracle above other windows while you play."
                checked={settings?.alwaysOnTop ?? false}
                disabled={isDisabled || pendingSetting === "alwaysOnTop"}
                onCheckedChange={(checked) =>
                  void handleSettingChange("alwaysOnTop", checked)
                }
              />

              <SettingField
                label="Developer mode"
                description="Enable developer tools and debug views."
                checked={settings?.developerMode ?? false}
                disabled={isDisabled || pendingSetting === "developerMode"}
                onCheckedChange={(checked) =>
                  void handleSettingChange("developerMode", checked)
                }
              />
            </CardContent>
          </Card>

          {(error || updateError) && (
            <p className="mt-3 text-sm text-destructive">
              {error?.message ?? updateError}
            </p>
          )}
        </TabsContent>

        <TabsContent value="providers">
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Provider configuration coming soon.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
