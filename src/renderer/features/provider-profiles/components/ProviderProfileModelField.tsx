import { Combobox } from "@renderer/components/ui/combobox"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@renderer/components/ui/field"
import { Input } from "@renderer/components/ui/input"
import { Spinner } from "@renderer/components/ui/spinner"
import { UseModelListResult } from "@renderer/features/provider-profiles/hooks/use-model-list"
import { ProviderProfileFormValues } from "@renderer/features/provider-profiles/types"
import { Control, Controller } from "react-hook-form"

type ProviderProfileModelFieldProps = {
  control: Control<ProviderProfileFormValues>
  fieldId: string
  modelList: UseModelListResult
}

export function ProviderProfileModelField({
  control,
  fieldId,
  modelList,
}: ProviderProfileModelFieldProps) {
  return (
    <Controller
      name="selectedModel"
      control={control}
      render={({ field }) => (
        <Field>
          <FieldLabel htmlFor={fieldId}>Model</FieldLabel>
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
                id={fieldId}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                placeholder="Enter the model id"
              />
              <FieldDescription>
                Live model lookup failed, so you can enter a model id manually.
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
  )
}
