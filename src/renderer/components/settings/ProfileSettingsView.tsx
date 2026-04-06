import { ProviderProfileForm } from "@renderer/components/settings/ProviderProfileForm"
import { Button } from "@renderer/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@renderer/components/ui/card"
import { useProviders } from "@renderer/hooks/use-providers"
import {
  CreateProviderProfileInput,
  UpdateProviderProfileInput,
} from "@shared/electron-types"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

export function ProfileSettingsView() {
  const {
    error,
    isLoading,
    profiles,
    selectedProfile,
    selectedProfileId,
    addProfile,
    removeProfile,
    selectProfile,
    updateProfile,
  } = useProviders()
  const sortedProfiles = Object.values(profiles).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  const [isCreating, setIsCreating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isCreateMode = isCreating || sortedProfiles.length === 0

  const canDelete = sortedProfiles.length > 1 && selectedProfileId !== null

  const handleCreate = async (values: UpdateProviderProfileInput) => {
    const apiKey = values.apiKey?.trim()

    if (!apiKey) {
      throw new Error("Provider profiles require an API key.")
    }

    setIsSubmitting(true)

    try {
      await addProfile({
        name: values.name,
        providerKey: values.providerKey,
        selectedModel: values.selectedModel,
        apiKey,
      } satisfies CreateProviderProfileInput)
      setIsCreating(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (values: UpdateProviderProfileInput) => {
    if (!selectedProfileId) {
      throw new Error("Select a profile before editing it.")
    }

    setIsSubmitting(true)

    try {
      await updateProfile(selectedProfileId, values)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedProfileId) {
      return
    }

    await removeProfile(selectedProfileId)
    if (sortedProfiles.length === 1) {
      setIsCreating(true)
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div>
          <CardTitle>Providers</CardTitle>
          <CardDescription>
            Manage saved provider profiles for chat and onboarding.
          </CardDescription>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <select
            value={isCreateMode ? "" : selectedProfileId ?? ""}
            onChange={(event) => {
              setIsCreating(false)
              selectProfile(event.target.value).catch(console.error)
            }}
            disabled={isLoading || sortedProfiles.length === 0}
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-input/20 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50 dark:bg-input/30"
          >
            {sortedProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreating(true)}
            >
              <PlusIcon />
              New profile
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleDelete().catch(console.error)
              }}
              disabled={!canDelete}
            >
              <Trash2Icon />
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {sortedProfiles.length === 0 && !isCreateMode ? (
          <CardDescription>
            No provider profiles have been saved yet. Create one below.
          </CardDescription>
        ) : null}

        <ProviderProfileForm
          key={isCreateMode ? "create" : selectedProfile?.id ?? "empty"}
          initialProfile={isCreateMode ? null : selectedProfile}
          submitLabel={isCreateMode ? "Save profile" : "Update profile"}
          isSubmitting={isSubmitting}
          onSubmit={isCreateMode ? handleCreate : handleUpdate}
        />

        {error && <p className="text-xs text-destructive">{error.message}</p>}
      </CardContent>
    </Card>
  )
}
