import {
  Field,
  FieldLabel,
} from "@renderer/components/ui/field"
import { Input } from "@renderer/components/ui/input"
import { ProviderProfileFormValues } from "@renderer/features/provider-profiles/types"
import { Control, Controller } from "react-hook-form"

type SettingsProviderProfileNameFieldProps = {
  control: Control<ProviderProfileFormValues>
}

export function SettingsProviderProfileNameField({
  control,
}: SettingsProviderProfileNameFieldProps) {
  return (
    <Controller
      name="name"
      control={control}
      render={({ field }) => (
        <Field>
          <FieldLabel htmlFor="settings-provider-profile-name">
            Profile name
          </FieldLabel>
          <Input
            {...field}
            id="settings-provider-profile-name"
            placeholder="Groq Primary"
          />
        </Field>
      )}
    />
  )
}
