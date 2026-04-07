import { SettingsProviderProfileNameField } from "@renderer/components/settings/SettingsProviderProfileNameField"
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
import { defaultProviderKey, providerConfig } from "@renderer/lib/ai"
import {
  ProviderKey,
  ProviderProfile,
  UpdateProviderProfileInput,
} from "@shared/electron-types"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"

type SettingsProviderProfileFormProps = {
  initialProfile?: ProviderProfile | null
  isSubmitting?: boolean
  submitLabel: string
  onSubmit: (values: UpdateProviderProfileInput) => Promise<void>
}

function getProviderProfileFormValues(
  profile: ProviderProfile | null,
): ProviderProfileFormValues {
  return {
    name: profile?.name ?? "",
    providerKey: profile?.providerKey ?? defaultProviderKey,
    apiKey: "",
    selectedModel: profile?.selectedModel ?? "",
  }
}

export function SettingsProviderProfileForm({
  initialProfile = null,
  isSubmitting = false,
  submitLabel,
  onSubmit,
}: SettingsProviderProfileFormProps) {
  const [error, setError] = useState<string | null>(null)
  const form = useForm<ProviderProfileFormValues>({
    defaultValues: getProviderProfileFormValues(initialProfile),
  })

  useEffect(() => {
    form.reset(getProviderProfileFormValues(initialProfile))
    setError(null)
  }, [form, initialProfile])

  const providerKey = form.watch("providerKey")
  const apiKey = form.watch("apiKey")
  const selectedModel = form.watch("selectedModel")
  const hasStoredApiKey =
    initialProfile !== null &&
    initialProfile.hasApiKey &&
    providerKey === initialProfile.providerKey
  const storedApiKeyProfileId =
    hasStoredApiKey && apiKey.trim() === "" ? initialProfile.id : undefined
  const modelList = useModelList({
    providerKey,
    apiKeyOverride: apiKey,
    storedApiKeyProfileId,
  })
  const hasResolvedApiKey = apiKey.trim() !== "" || hasStoredApiKey
  const isFormValid =
    form.watch("name").trim() !== "" &&
    selectedModel.trim() !== "" &&
    hasResolvedApiKey
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
        selectedModel: values.selectedModel.trim(),
        apiKey: values.apiKey.trim() || undefined,
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
        <SettingsProviderProfileNameField control={form.control} />

        <ProviderProfileSelectField
          control={form.control}
          fieldId="settings-provider-profile-provider"
          onProviderChange={(nextProviderKey: ProviderKey) => {
            form.setValue("selectedModel", "")

            if (
              initialProfile &&
              nextProviderKey !== initialProfile.providerKey
            ) {
              form.setValue("apiKey", "")
            }
          }}
        />

        <ProviderProfileApiKeyField
          control={form.control}
          fieldId="settings-provider-profile-api-key"
          hasStoredApiKey={hasStoredApiKey}
          label={`${providerLabel} API key`}
        />

        <ProviderProfileModelField
          control={form.control}
          fieldId="settings-provider-profile-model"
          modelList={modelList}
        />
      </FieldGroup>

      {(error || modelList.error) && (
        <FieldError>{error ?? modelList.error}</FieldError>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={!isFormValid || isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  )
}
