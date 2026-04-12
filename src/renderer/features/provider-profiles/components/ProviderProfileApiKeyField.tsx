import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@renderer/components/ui/field"
import { Input } from "@renderer/components/ui/input"
import {
  ProviderProfileFormValues,
} from "@renderer/features/provider-profiles/types"
import { Control, useController } from "react-hook-form"

type ProviderProfileApiKeyFieldProps = {
  control: Control<ProviderProfileFormValues>
  fieldId: string
  label: string
}

export function ProviderProfileApiKeyField({
  control,
  fieldId,
  label,
}: ProviderProfileApiKeyFieldProps) {
  const { field, fieldState } = useController({
    control,
    name: "apiKey",
  })

  return (
    <Field>
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      <Input
        id={fieldId}
        name={field.name}
        type="password"
        value={field.value}
        onBlur={field.onBlur}
        onChange={field.onChange}
      />
      <FieldDescription>
        This key is stored in the OS credential manager, not in app settings.
      </FieldDescription>
      {fieldState.error && (
        <FieldError>{fieldState.error.message}</FieldError>
      )}
    </Field>
  )
}
