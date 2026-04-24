import { Combobox } from "@renderer/components/ui/combobox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@renderer/components/ui/field"
import { Input } from "@renderer/components/ui/input"
import { Spinner } from "@renderer/components/ui/spinner"
import { useModelList } from "@renderer/features/provider-profiles/hooks/use-model-list"
import { useProviderProfileSettings } from "@renderer/features/provider-profiles/hooks/use-provider-profile-settings"
import { useProviderProfileModelSetter } from "@renderer/features/provider-profiles/queries/provider-profiles-query"
import { ProviderKey } from "@shared/provider-profile-types"

type ProviderProfileSettingsModelFieldProps = {
  selectedModel: string
  providerKey: ProviderKey
  apiKey: string
}

export function ProviderProfileSettingsModelField({
  selectedModel,
  providerKey,
  apiKey,
}: ProviderProfileSettingsModelFieldProps) {
  const { editingProfileId } = useProviderProfileSettings()
  const { mutate: setModel } = useProviderProfileModelSetter(editingProfileId)
  const modelList = useModelList({ providerKey, apiKeyOverride: apiKey })

  const handleCommit = (nextModel: string) => {
    setModel(nextModel.trim())
  }

  return (
    <Field>
      <FieldLabel htmlFor="settings-provider-profile-model">Model</FieldLabel>
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
            defaultValue={selectedModel}
            onChange={(e) => handleCommit(e.target.value)}
            placeholder="Enter the model id"
          />
          <FieldDescription>
            Live model lookup failed, so you can enter a model id manually.
          </FieldDescription>
        </>
      ) : (
        <Combobox
          items={modelList.models}
          value={selectedModel}
          onValueChange={(value) => handleCommit(value)}
          placeholder="Search available models"
        />
      )}
      {modelList.error && <FieldError>{modelList.error}</FieldError>}
    </Field>
  )
}
