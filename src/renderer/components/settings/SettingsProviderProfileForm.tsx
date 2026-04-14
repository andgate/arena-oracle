import { SettingsProviderProfileNameField } from "@renderer/components/settings/SettingsProviderProfileNameField"
import { FieldError, FieldGroup } from "@renderer/components/ui/field"
import { ProviderProfileApiKeyField } from "@renderer/features/provider-profiles/components/ProviderProfileApiKeyField"
import { ProviderProfileModelField } from "@renderer/features/provider-profiles/components/ProviderProfileModelField"
import { ProviderProfileSelectField } from "@renderer/features/provider-profiles/components/ProviderProfileSelectField"
import { useModelList } from "@renderer/features/provider-profiles/hooks/use-model-list"
import { ProviderProfileFormValues } from "@renderer/features/provider-profiles/types"
import { defaultProviderKey, providerConfig } from "@shared/provider-config"
import {
  ProviderKey,
  ProviderProfile,
  ProviderProfileInput,
} from "@shared/provider-profile-types"
import { useEffect, useRef } from "react"
import { useForm } from "react-hook-form"

type SettingsProviderProfileFormProps = {
  editingProfileId: string | null
  isLoading?: boolean
  onCreateProfile: () => Promise<ProviderProfile>
  onDeleteProfile: () => Promise<void>
  onDiscardCreatedProfile: (
    profileId: string,
    restoreProfileId: string | null,
  ) => Promise<void>
  onSelectProfile: (profileId: string) => void
  profile: ProviderProfile | null
  profiles: ProviderProfile[]
  onChange: (updates: ProviderProfileInput) => Promise<ProviderProfile>
}

function getProviderProfileFormValues(
  profile: ProviderProfile | null,
): ProviderProfileFormValues {
  return {
    name: profile?.name ?? "",
    providerKey: profile?.providerKey ?? defaultProviderKey,
    apiKey: profile?.apiKey ?? "",
    selectedModel: profile?.selectedModel ?? "",
  }
}

export function SettingsProviderProfileForm({
  editingProfileId,
  isLoading = false,
  onCreateProfile,
  onDeleteProfile,
  onDiscardCreatedProfile,
  onSelectProfile,
  profile,
  profiles,
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
  const resetKeyRef = useRef<string | null>(profile?.id ?? null)

  const modelList = useModelList({
    providerKey,
    apiKeyOverride: apiKey,
  })
  const providerLabel = providerConfig[providerKey].label

  useEffect(() => {
    const nextProfileId = profile?.id ?? null

    // Guard against resets when profile wasn't switched
    if (resetKeyRef.current === nextProfileId) {
      return
    }

    resetKeyRef.current = nextProfileId
    isFirstRender.current = true
    form.reset(getProviderProfileFormValues(profile))
  }, [form, profile])

  const persistValues = async (values: ProviderProfileFormValues) => {
    if (!profile) {
      throw new Error("Select a profile before editing it.")
    }

    return onChange({
      name: values.name.trim(),
      providerKey: values.providerKey,
      selectedModel: values.selectedModel.trim(),
      apiKey: values.apiKey.trim(),
    })
  }

  // Auto-save effect
  useEffect(() => {
    if (!profile) {
      return
    }

    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    const timeout = setTimeout(() => {
      persistValues({
        name,
        providerKey,
        selectedModel,
        apiKey,
      }).catch((err) => {
        // TODO more robust auto-save error handling.
        // In the UI, Show an error indicator when save fails
        console.error("Failed to auto-save provider profile", err)
      })
    }, 400)

    return () => clearTimeout(timeout)
  }, [apiKey, name, persistValues, profile, providerKey, selectedModel])

  return (
    <div className="space-y-4">
      <FieldGroup>
        <SettingsProviderProfileNameField
          editingProfileId={editingProfileId}
          isBusy={isLoading}
          onAcceptDraftName={async (nextName) => {
            isFirstRender.current = true
            form.setValue("name", nextName, { shouldDirty: true })

            try {
              await persistValues({
                ...form.getValues(),
                name: nextName,
              })
            } catch (error) {
              isFirstRender.current = false
              throw error
            }
          }}
          onCreateProfile={onCreateProfile}
          onDeleteProfile={onDeleteProfile}
          onDiscardCreatedProfile={onDiscardCreatedProfile}
          onSelectProfile={onSelectProfile}
          profileOptions={profiles}
        />

        {profile && (
          <>
            <ProviderProfileSelectField
              control={form.control}
              fieldId="settings-provider-profile-provider"
              onProviderChange={(nextProviderKey: ProviderKey) => {
                form.setValue("selectedModel", "")

                // When the incoming provider is actually different
                // then clear the apikey field
                const didProviderChange =
                  nextProviderKey !==
                  (profile.providerKey ?? defaultProviderKey)
                if (didProviderChange) {
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
          </>
        )}
      </FieldGroup>

      {profile && modelList.error && <FieldError>{modelList.error}</FieldError>}
    </div>
  )
}
