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
import {
  fetchModelsForProvider,
  providerModelsListConfig,
} from "@renderer/lib/ai"
import { CreateProviderProfileInput, ProviderKey } from "@shared/electron-types"
import { SubmitEventHandler, useEffect, useState } from "react"

const providerOptions: Record<ProviderKey, string> = {
  groq: "Groq",
  openrouter: "OpenRouter",
}

type ProviderProfileFormProps = {
  isSubmitting?: boolean
  onSubmit: (values: CreateProviderProfileInput) => Promise<void>
}

export function ProviderProfileForm({
  isSubmitting = false,
  onSubmit,
}: ProviderProfileFormProps) {
  const [name, setName] = useState("")
  const [providerKey, setProviderKey] = useState<ProviderKey>("groq")
  const [apiKey, setApiKey] = useState("")
  const [selectedModel, setSelectedModel] = useState("")
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modelFetchError, setModelFetchError] = useState<string | null>(null)

  const modelsListRequiresApiKey =
    providerModelsListConfig[providerKey].requiresApiKey
  const canFetchModels = !modelsListRequiresApiKey || apiKey.trim() !== ""
  const isFormValid =
    name.trim() !== "" && apiKey.trim() !== "" && selectedModel.trim() !== ""
  const providerLabel = providerOptions[providerKey] ?? providerKey

  useEffect(() => {
    if (!canFetchModels) {
      setAvailableModels([])
      setModelFetchError(null)
      setIsLoadingModels(false)
      return
    }

    let cancelled = false

    const loadModels = async () => {
      setIsLoadingModels(true)
      setModelFetchError(null)

      try {
        const models = await fetchModelsForProvider(
          providerKey,
          modelsListRequiresApiKey ? apiKey.trim() : undefined,
        )

        if (cancelled) {
          return
        }

        setAvailableModels(Array.from(new Set(models)).sort())
      } catch (nextError) {
        if (cancelled) {
          return
        }

        setAvailableModels([])
        setModelFetchError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to fetch models for this provider.",
        )
      } finally {
        if (!cancelled) {
          setIsLoadingModels(false)
        }
      }
    }

    loadModels().catch(console.error)

    return () => {
      cancelled = true
    }
  }, [apiKey, canFetchModels, modelsListRequiresApiKey, providerKey])

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()

    if (!isFormValid) {
      return
    }

    setError(null)

    try {
      await onSubmit({
        name: name.trim(),
        providerKey,
        apiKey: apiKey.trim(),
        selectedModel: selectedModel.trim(),
      })
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to save provider profile.",
      )
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="onboarding-provider-profile-name">
            Profile name
          </FieldLabel>
          <Input
            id="onboarding-provider-profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Groq Primary"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="onboarding-provider-profile-provider">
            API provider
          </FieldLabel>
          <Select
            value={providerKey}
            onValueChange={(value) => {
              setProviderKey(value as ProviderKey)
              setSelectedModel("")
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
                {Object.entries(providerOptions).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="onboarding-provider-profile-api-key">
            {providerLabel} API key
          </FieldLabel>
          <Input
            id="onboarding-provider-profile-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Paste your API key"
          />
          <FieldDescription>
            This key is stored in the OS credential manager, not in app
            settings.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="onboarding-provider-profile-model">
            Model
          </FieldLabel>
          {!canFetchModels ? (
            <FieldDescription>
              Enter an API key to load models for this provider.
            </FieldDescription>
          ) : isLoadingModels ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Spinner className="size-3.5" />
              Loading available models...
            </div>
          ) : modelFetchError ? (
            <>
              <Input
                id="onboarding-provider-profile-model"
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                placeholder="Enter the model id"
              />
              <FieldDescription>
                Live model lookup failed, so you can enter a model id manually.
              </FieldDescription>
            </>
          ) : (
            <Combobox
              items={availableModels}
              value={selectedModel}
              onValueChange={setSelectedModel}
              placeholder="Search available models"
            />
          )}
        </Field>
      </FieldGroup>

      {(error || modelFetchError) && (
        <FieldError>{error ?? modelFetchError}</FieldError>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={!isFormValid || isSubmitting}>
          {isSubmitting ? "Saving..." : "Save provider"}
        </Button>
      </div>
    </form>
  )
}
