import { Card, CardContent } from "@renderer/components/ui/card"
import { Switch } from "@renderer/components/ui/switch"
import { useSettings } from "@renderer/hooks/use-settings"
import { useState } from "react"

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

export function GeneralSettingsView() {
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
    <>
      <Card>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <SettingField
            label="Always on top"
            description="Keep Arena Oracle above other windows while you play."
            checked={settings?.alwaysOnTop ?? false}
            disabled={isDisabled || pendingSetting === "alwaysOnTop"}
            onCheckedChange={(checked) =>
              handleSettingChange("alwaysOnTop", checked).catch(console.error)
            }
          />

          <SettingField
            label="Developer mode"
            description="Enable developer tools and debug views."
            checked={settings?.developerMode ?? false}
            disabled={isDisabled || pendingSetting === "developerMode"}
            onCheckedChange={(checked) =>
              handleSettingChange("developerMode", checked).catch(console.error)
            }
          />
        </CardContent>
      </Card>

      {(error || updateError) && (
        <p className="mt-3 text-sm text-destructive">
          {error?.message ?? updateError}
        </p>
      )}
    </>
  )
}
