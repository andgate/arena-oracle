import { Button } from "@renderer/components/ui/button"
import { Combobox } from "@renderer/components/ui/combobox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@renderer/components/ui/field"
import { Input } from "@renderer/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select"
import { Spinner } from "@renderer/components/ui/spinner"
import { useModelList } from "@renderer/hooks/use-models-list"
import { defaultProviderKey, providerConfig } from "@renderer/lib/ai"
import {
  ProviderKey,
  ProviderProfile,
  UpdateProviderProfileInput,
} from "@shared/electron-types"
import { useEffect, useState } from "react"
import { Control, Controller, useController, useForm } from "react-hook-form"

const savedApiKeyMask = "************"

type ProviderProfileFormValues = {
  name: string
  providerKey: ProviderKey
  apiKey: string
  selectedModel: string
}

type ProviderProfileFormProps = {
  initialProfile?: ProviderProfile | null
  isSubmitting?: boolean
  submitLabel: string
  onSubmit: (values: UpdateProviderProfileInput) => Promise<void>
}

type ProviderApiKeyFieldProps = {
  control: Control<ProviderProfileFormValues>
  fieldId: string
  hasStoredApiKey: boolean
  label: string
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

function ProviderApiKeyField({
  control,
  fieldId,
  hasStoredApiKey,
  label,
}: ProviderApiKeyFieldProps) {
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
        placeholder={hasStoredApiKey ? "Saved API key" : "Paste your API key"}
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

export function ProviderProfileForm({
  initialProfile = null,
  isSubmitting = false,
  submitLabel,
  onSubmit,
}: ProviderProfileFormProps) {
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
        <Controller
          name="name"
          control={form.control}
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

        <Controller
          name="providerKey"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="settings-provider-profile-provider">
                API provider
              </FieldLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value as ProviderKey)
                  form.setValue("selectedModel", "")

                  if (
                    initialProfile &&
                    value !== initialProfile.providerKey
                  ) {
                    form.setValue("apiKey", "")
                  }
                }}
              >
                <SelectTrigger
                  id="settings-provider-profile-provider"
                  className="w-full"
                >
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

        <ProviderApiKeyField
          control={form.control}
          fieldId="settings-provider-profile-api-key"
          hasStoredApiKey={hasStoredApiKey}
          label={`${providerLabel} API key`}
        />

        <Controller
          name="selectedModel"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="settings-provider-profile-model">
                Model
              </FieldLabel>
              {!modelList.canFetchModels ? (
                <FieldDescription>
                  Enter an API key to load models for this provider.
                </FieldDescription>
              ) : modelList.isLoading ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <Spinner className="size-3.5" />
                  Loading available models...
                </div>
              ) : modelList.error ? (
                <>
                  <Input
                    id="settings-provider-profile-model"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    placeholder="Enter the model id"
                  />
                  <FieldDescription>
                    Live model lookup failed, so you can enter a model id
                    manually.
                  </FieldDescription>
                </>
              ) : (
                <Combobox
                  items={modelList.models}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Search available models"
                />
              )}
            </Field>
          )}
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
