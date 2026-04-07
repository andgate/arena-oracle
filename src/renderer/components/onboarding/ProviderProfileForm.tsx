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
import { CreateProviderProfileInput, ProviderKey } from "@shared/electron-types"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"

type ProviderProfileFormValues = {
  name: string
  providerKey: ProviderKey
  apiKey: string
  selectedModel: string
}

type ProviderProfileFormProps = {
  isSubmitting?: boolean
  onSubmit: (values: CreateProviderProfileInput) => Promise<void>
}

export function ProviderProfileForm({
  isSubmitting = false,
  onSubmit,
}: ProviderProfileFormProps) {
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
        <Controller
          name="name"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="onboarding-provider-profile-name">
                Profile name
              </FieldLabel>
              <Input
                {...field}
                id="onboarding-provider-profile-name"
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
              <FieldLabel htmlFor="onboarding-provider-profile-provider">
                API provider
              </FieldLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value as ProviderKey)
                  form.setValue("selectedModel", "")
                }}
              >
                <SelectTrigger
                  id="onboarding-provider-profile-provider"
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

        <Controller
          name="apiKey"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="onboarding-provider-profile-api-key">
                {providerLabel} API key
              </FieldLabel>
              <Input
                {...field}
                id="onboarding-provider-profile-api-key"
                type="password"
                placeholder="Paste your API key"
              />
              <FieldDescription>
                This key is stored in the OS credential manager, not in app
                settings.
              </FieldDescription>
            </Field>
          )}
        />

        <Controller
          name="selectedModel"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="onboarding-provider-profile-model">
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
                    id="onboarding-provider-profile-model"
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
          {isSubmitting ? "Saving..." : "Save provider"}
        </Button>
      </div>
    </form>
  )
}
