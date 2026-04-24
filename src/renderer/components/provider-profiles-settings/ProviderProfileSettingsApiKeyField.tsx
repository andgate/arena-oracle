import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@renderer/components/ui/field"
import { Input } from "@renderer/components/ui/input"
import { useProviderProfileSettings } from "@renderer/features/provider-profiles/hooks/use-provider-profile-settings"
import { useProviderProfileApiKeySetter } from "@renderer/features/provider-profiles/queries/provider-profiles-query"
import { providerConfig } from "@shared/provider-config"
import { ProviderKey } from "@shared/provider-profile-types"
import { useEffect, useState } from "react"

type ProviderProfileSettingsApiKeyFieldProps = {
  apiKey: string
  providerKey: ProviderKey
}

export function ProviderProfileSettingsApiKeyField({
  apiKey,
  providerKey,
}: ProviderProfileSettingsApiKeyFieldProps) {
  const { editingProfileId } = useProviderProfileSettings()
  const { mutate: setApiKey } = useProviderProfileApiKeySetter(editingProfileId)
  const [localApiKey, setLocalApiKey] = useState(apiKey)

  useEffect(() => {
    setLocalApiKey(apiKey)
  }, [apiKey])

  const providerLabel = providerConfig[providerKey].label

  const handleChange = (value: string) => {
    setLocalApiKey(value)
    setApiKey(value.trim())
  }

  return (
    <Field>
      <FieldLabel htmlFor="settings-provider-profile-api-key">
        {providerLabel} API key
      </FieldLabel>
      <Input
        id="settings-provider-profile-api-key"
        type="password"
        value={localApiKey}
        onChange={(e) => handleChange(e.target.value)}
      />
      <FieldDescription>
        This key is stored in the OS credential manager, not in app settings.
      </FieldDescription>
    </Field>
  )
}
