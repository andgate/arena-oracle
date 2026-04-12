import { SettingsProviderProfileNameField } from "@renderer/components/settings/SettingsProviderProfileNameField"
import { FieldError, FieldGroup } from "@renderer/components/ui/field"
import { ProviderProfileApiKeyField } from "@renderer/features/provider-profiles/components/ProviderProfileApiKeyField"
import { ProviderProfileModelField } from "@renderer/features/provider-profiles/components/ProviderProfileModelField"
import { ProviderProfileSelectField } from "@renderer/features/provider-profiles/components/ProviderProfileSelectField"
import { useModelList } from "@renderer/features/provider-profiles/hooks/use-model-list"
import { ProviderProfileFormValues } from "@renderer/features/provider-profiles/types"
import {
  ProviderKey,
  ProviderProfile,
  ProviderProfileInput,
} from "@shared/provider-profile-types"
import { defaultProviderKey, providerConfig } from "@shared/provider-config"
import { useEffect, useRef } from "react"
import { useForm } from "react-hook-form"

type SettingsProviderProfileFormProps = {
  profile: ProviderProfile
  onChange: (updates: ProviderProfileInput) => Promise<ProviderProfile>
}

function getProviderProfileFormValues(
  profile: ProviderProfile,
): ProviderProfileFormValues {
  return {
    name: profile.name ?? "",
    providerKey: profile.providerKey ?? defaultProviderKey,
    apiKey: profile.apiKey ?? "",
    selectedModel: profile.selectedModel ?? "",
  }
}

export function SettingsProviderProfileForm({
  profile,
  onChange,
}: SettingsProviderProfileFormProps) {
  const form = useForm<ProviderProfileFormValues>({
    defaultValues: getProviderProfileFormValues(profile),
  })
  const name = form.watch("name")
  const providerKey = form.watch("providerKey")
  const apiKey = form.watch("apiKey")
  const selectedModel = form.watch("selectedModel")

  const isFirstRender = useRef(true)

  const modelList = useModelList({
    providerKey,
    apiKeyOverride: apiKey,
  })
  const providerLabel = providerConfig[providerKey].label

  // Auto-save effect
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    const timeout = setTimeout(() => {
      const trimmedKey = apiKey.trim()

      onChange({
        name: name.trim(),
        providerKey,
        selectedModel: selectedModel.trim(),
        apiKey: trimmedKey,
      }).catch((err) => {
        console.error("Failed to auto-save provider profile", err)
      })
    }, 400)

    return () => clearTimeout(timeout)
  }, [apiKey, name, onChange, providerKey, selectedModel])

  return (
    <div className="space-y-4">
      <FieldGroup>
        <SettingsProviderProfileNameField control={form.control} />

        <ProviderProfileSelectField
          control={form.control}
          fieldId="settings-provider-profile-provider"
          onProviderChange={(nextProviderKey: ProviderKey) => {
            form.setValue("selectedModel", "")

            if (
              nextProviderKey !== (profile.providerKey ?? defaultProviderKey)
            ) {
              form.setValue("apiKey", "")
            }
          }}
        />

        <ProviderProfileApiKeyField
          control={form.control}
          fieldId="settings-provider-profile-api-key"
          label={`${providerLabel} API key`}
        />

        <ProviderProfileModelField
          control={form.control}
          fieldId="settings-provider-profile-model"
          modelList={modelList}
        />
      </FieldGroup>

      {modelList.error && <FieldError>{modelList.error}</FieldError>}
    </div>
  )
}
