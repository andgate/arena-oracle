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
import { ProviderProfileFormValues } from "@renderer/features/provider-profiles/types"
import { providerConfig } from "@shared/provider-config"
import { ProviderKey } from "@shared/electron-types"
import { Control, Controller } from "react-hook-form"

type ProviderProfileSelectFieldProps = {
  control: Control<ProviderProfileFormValues>
  fieldId: string
  onProviderChange?: (providerKey: ProviderKey) => void
}

export function ProviderProfileSelectField({
  control,
  fieldId,
  onProviderChange,
}: ProviderProfileSelectFieldProps) {
  return (
    <Controller
      name="providerKey"
      control={control}
      render={({ field }) => (
        <Field>
          <FieldLabel htmlFor={fieldId}>API provider</FieldLabel>
          <Select
            value={field.value}
            onValueChange={(value) => {
              const nextProviderKey = value as ProviderKey

              field.onChange(nextProviderKey)
              onProviderChange?.(nextProviderKey)
            }}
          >
            <SelectTrigger id={fieldId} className="w-full">
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
      )}
    />
  )
}
