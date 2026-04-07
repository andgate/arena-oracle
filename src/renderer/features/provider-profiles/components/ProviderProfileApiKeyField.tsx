import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@renderer/components/ui/field"
import { Input } from "@renderer/components/ui/input"
import { ProviderProfileFormValues } from "@renderer/features/provider-profiles/types"
import { useEffect, useState } from "react"
import { Control, useController } from "react-hook-form"

const savedApiKeyMask = "************"

type ProviderProfileApiKeyFieldProps = {
  control: Control<ProviderProfileFormValues>
  fieldId: string
  hasStoredApiKey?: boolean
  label: string
}

export function ProviderProfileApiKeyField({
  control,
  fieldId,
  hasStoredApiKey = false,
  label,
}: ProviderProfileApiKeyFieldProps) {
  const { field } = useController({
    control,
    name: "apiKey",
  })
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setIsEditing(false)
  }, [hasStoredApiKey])

  const showSavedApiKeyMask =
    hasStoredApiKey && field.value === "" && !isEditing

  return (
    <Field>
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      <Input
        id={fieldId}
        name={field.name}
        type="password"
        value={showSavedApiKeyMask ? savedApiKeyMask : field.value}
        onFocus={() => setIsEditing(true)}
        onBlur={() => {
          field.onBlur()

          if (field.value === "") {
            setIsEditing(false)
          }
        }}
        onChange={(event) => {
          setIsEditing(true)
          field.onChange(event.target.value)
        }}
      />
      {hasStoredApiKey ? (
        <FieldDescription>
          Leave this blank to keep the saved API key for this profile.
        </FieldDescription>
      ) : (
        <FieldDescription>
          This key is stored in the OS credential manager, not in app settings.
        </FieldDescription>
      )}
    </Field>
  )
}
