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
  fetchModelsForProfile,
  fetchModelsForProvider,
  providerModelsListConfig,
} from "@renderer/lib/ai"
import {
  ProviderKey,
  ProviderProfile,
  UpdateProviderProfileInput,
} from "@shared/electron-types"
import { SubmitEventHandler, useEffect, useState } from "react"

const providerOptions: Record<ProviderKey, string> = {
  groq: "Groq",
  openrouter: "OpenRouter",
}

type ProviderProfileFormProps = {
  initialProfile?: ProviderProfile | null
  isSubmitting?: boolean
  submitLabel: string
  onSubmit: (values: UpdateProviderProfileInput) => Promise<void>
}

export function ProviderProfileForm({
  initialProfile = null,
  isSubmitting = false,
  submitLabel,
  onSubmit,
}: ProviderProfileFormProps) {
  const [name, setName] = useState(initialProfile?.name ?? "")
  const [providerKey, setProviderKey] = useState<ProviderKey>(
    initialProfile?.providerKey ?? "groq",
  )
  const [apiKey, setApiKey] = useState("")
  const [selectedModel, setSelectedModel] = useState(
    initialProfile?.selectedModel ?? "",
  )
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modelFetchError, setModelFetchError] = useState<string | null>(null)

  useEffect(() => {
    setName(initialProfile?.name ?? "")
    setProviderKey(initialProfile?.providerKey ?? "groq")
    setApiKey("")
    setSelectedModel(initialProfile?.selectedModel ?? "")
    setAvailableModels([])
    setIsLoadingModels(false)
    setError(null)
    setModelFetchError(null)
  }, [initialProfile])

  const modelsListRequiresApiKey =
    providerModelsListConfig[providerKey].requiresApiKey
  const canReuseStoredApiKey =
    initialProfile !== null &&
    initialProfile.hasApiKey &&
    providerKey === initialProfile.providerKey &&
    apiKey.trim() === ""
  const hasResolvedApiKey = apiKey.trim() !== "" || canReuseStoredApiKey
  const canFetchModels = !modelsListRequiresApiKey || hasResolvedApiKey
  const isFormValid =
    name.trim() !== "" && selectedModel.trim() !== "" && hasResolvedApiKey
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
        const models =
          modelsListRequiresApiKey && apiKey.trim() === "" && initialProfile
            ? await fetchModelsForProfile(initialProfile)
            : await fetchModelsForProvider(
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
  }, [
    apiKey,
    canFetchModels,
    initialProfile,
    modelsListRequiresApiKey,
    providerKey,
  ])

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
        selectedModel: selectedModel.trim(),
        apiKey: apiKey.trim() || undefined,
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
          <FieldLabel htmlFor="settings-provider-profile-name">
            Profile name
          </FieldLabel>
          <Input
            id="settings-provider-profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Groq Primary"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="settings-provider-profile-provider">
            API provider
          </FieldLabel>
          <Select
            value={providerKey}
            onValueChange={(value) => {
              const nextProviderKey = value as ProviderKey
              setProviderKey(nextProviderKey)
              setSelectedModel("")

              if (
                initialProfile &&
                nextProviderKey !== initialProfile.providerKey
              ) {
                setApiKey("")
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
          <FieldLabel htmlFor="settings-provider-profile-api-key">
            {providerLabel} API key
          </FieldLabel>
          <Input
            id="settings-provider-profile-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={
              canReuseStoredApiKey ? "Saved API key" : "Paste your API key"
            }
          />
          {canReuseStoredApiKey ? (
            <FieldDescription>
              Leave this blank to keep the saved API key for this profile.
            </FieldDescription>
          ) : (
            <FieldDescription>
              This key is stored in the OS credential manager, not in app
              settings.
            </FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="settings-provider-profile-model">
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
                id="settings-provider-profile-model"
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
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  )
}
