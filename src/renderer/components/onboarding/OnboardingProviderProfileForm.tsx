import { OnboardingProviderProfileNameField } from "@renderer/components/onboarding/OnboardingProviderProfileNameField"
import { Button } from "@renderer/components/ui/button"
import {
  FieldError,
  FieldGroup,
} from "@renderer/components/ui/field"
import { ProviderProfileApiKeyField } from "@renderer/features/provider-profiles/components/ProviderProfileApiKeyField"
import { ProviderProfileModelField } from "@renderer/features/provider-profiles/components/ProviderProfileModelField"
import { ProviderProfileSelectField } from "@renderer/features/provider-profiles/components/ProviderProfileSelectField"
import { useModelList } from "@renderer/features/provider-profiles/hooks/use-model-list"
import { ProviderProfileFormValues } from "@renderer/features/provider-profiles/types"
import { ProviderProfileInput } from "@shared/electron-types"
import { defaultProviderKey, providerConfig } from "@shared/provider-config"
import { useState } from "react"
import { useForm } from "react-hook-form"

type OnboardingProviderProfileFormProps = {
  isSubmitting?: boolean
  onSubmit: (values: ProviderProfileInput) => Promise<void>
}

export function OnboardingProviderProfileForm({
  isSubmitting = false,
  onSubmit,
}: OnboardingProviderProfileFormProps) {
  const [error, setError] = useState<string | null>(null)
  const form = useForm<ProviderProfileFormValues>({
    defaultValues: {
      name: "",
      providerKey: defaultProviderKey,
      apiKey: "",
      selectedModel: "",
    },
  })

  const providerKey = form.watch("providerKey")
  const apiKey = form.watch("apiKey")
  const selectedModel = form.watch("selectedModel")
  const modelList = useModelList({
    providerKey,
    apiKeyOverride: apiKey,
  })
  const isFormValid =
    form.watch("name").trim() !== "" &&
    apiKey.trim() !== "" &&
    selectedModel.trim() !== ""
  const providerLabel = providerConfig[providerKey].label

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!isFormValid) {
      return
    }

    setError(null)

    try {
      await onSubmit({
        name: values.name.trim(),
        providerKey: values.providerKey,
        apiKey: values.apiKey.trim(),
        selectedModel: values.selectedModel.trim(),
      })
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to save provider profile.",
      )
    }
  })

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldGroup>
        <OnboardingProviderProfileNameField control={form.control} />

        <ProviderProfileSelectField
          control={form.control}
          fieldId="onboarding-provider-profile-provider"
          onProviderChange={() => form.setValue("selectedModel", "")}
        />

        <ProviderProfileApiKeyField
          control={form.control}
          fieldId="onboarding-provider-profile-api-key"
          label={`${providerLabel} API key`}
        />

        <ProviderProfileModelField
          control={form.control}
          fieldId="onboarding-provider-profile-model"
          modelList={modelList}
        />
      </FieldGroup>

      {(error || modelList.error) && (
        <FieldError>{error ?? modelList.error}</FieldError>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={!isFormValid || isSubmitting}>
          {isSubmitting ? "Saving..." : "Save provider"}
        </Button>
      </div>
    </form>
  )
}
