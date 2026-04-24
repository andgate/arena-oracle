import {
  Field,
  FieldLabel,
} from "@renderer/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select"
import { useProviderProfileSettings } from "@renderer/features/provider-profiles/hooks/use-provider-profile-settings"
import { useProviderProfileProviderSetter } from "@renderer/features/provider-profiles/queries/provider-profiles-query"
import { providerConfig } from "@shared/provider-config"
import { ProviderKey } from "@shared/provider-profile-types"

type ProviderProfileSettingsSelectFieldProps = {
  providerKey: ProviderKey
}

export function ProviderProfileSettingsSelectField({
  providerKey,
}: ProviderProfileSettingsSelectFieldProps) {
  const { editingProfileId } = useProviderProfileSettings()
  const { mutate: setProvider } = useProviderProfileProviderSetter(editingProfileId)

  const handleChange = (nextProviderKey: ProviderKey) => {
    setProvider(nextProviderKey)
  }

  return (
    <Field>
      <FieldLabel htmlFor="settings-provider-profile-provider">
        API provider
      </FieldLabel>
      <Select
        value={providerKey}
        onValueChange={(value) => handleChange(value as ProviderKey)}
      >
        <SelectTrigger id="settings-provider-profile-provider" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(providerConfig).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}
