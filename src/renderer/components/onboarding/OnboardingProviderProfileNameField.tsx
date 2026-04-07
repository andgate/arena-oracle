import { Field, FieldLabel } from "@renderer/components/ui/field"
import { Input } from "@renderer/components/ui/input"
import { ProviderProfileFormValues } from "@renderer/features/provider-profiles/types"
import { Control, Controller } from "react-hook-form"

type OnboardingProviderProfileNameFieldProps = {
  control: Control<ProviderProfileFormValues>
}

export function OnboardingProviderProfileNameField({
  control,
}: OnboardingProviderProfileNameFieldProps) {
  return (
    <Controller
      name="name"
      control={control}
      render={({ field }) => (
        <Field>
          <FieldLabel htmlFor="onboarding-provider-profile-name">
            Profile name
          </FieldLabel>
          <Input
            {...field}
            id="onboarding-provider-profile-name"
            placeholder="Enter a name"
          />
        </Field>
      )}
    />
  )
}
