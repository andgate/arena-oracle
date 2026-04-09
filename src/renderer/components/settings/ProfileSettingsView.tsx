import { SettingsProviderProfileForm } from "@renderer/components/settings/SettingsProviderProfileForm"
import { Button } from "@renderer/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@renderer/components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select"
import { useProviders } from "@renderer/hooks/use-providers"
import { defaultProviderKey } from "@shared/provider-config"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { useEffect, useState } from "react"

export function ProfileSettingsView() {
  const {
    error,
    isLoading,
    profiles,
    addProfile,
    removeProfile,
    updateProfile,
  } = useProviders()

  const sortedProfiles = Object.values(profiles).sort((a, b) =>
    (a.name ?? "untitled").localeCompare(b.name ?? "untitled"),
  )
  const [editingProfileId, setEditingProfileId] = useState<string | null>(
    sortedProfiles[0]?.id ?? null,
  )
  const editingProfile =
    (editingProfileId && profiles[editingProfileId]) ?? null
  const canDelete = editingProfileId !== null

  const handleProfileChange = (
    updates: Parameters<typeof updateProfile>[1],
  ) => {
    if (!editingProfile) {
      throw new Error("Select a profile before editing it.")
    }

    return updateProfile(editingProfile.id, updates)
  }

  useEffect(() => {
    if (editingProfileId) {
      return
    }

    setEditingProfileId(sortedProfiles[0]?.id ?? null)
  }, [editingProfileId, profiles, sortedProfiles])

  const handleNew = async () => {
    const newProfile = await addProfile({
      name: "",
      providerKey: defaultProviderKey,
    })
    setEditingProfileId(newProfile.id)
  }

  const handleDelete = async () => {
    if (!editingProfileId) {
      return
    }

    const fallbackId =
      sortedProfiles.find((profile) => profile.id !== editingProfileId)?.id ??
      null
    await removeProfile(editingProfileId)
    setEditingProfileId(fallbackId)
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
          <Select
            value={editingProfileId ?? ""}
            onValueChange={(value) => setEditingProfileId(value)}
            disabled={isLoading || sortedProfiles.length === 0}
          >
            <SelectTrigger className="min-w-0 flex-1">
              <SelectValue placeholder="Select a provider profile" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {sortedProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name ?? "untitled"}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleNew().catch(console.error)
              }}
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
        {editingProfile && (
          <SettingsProviderProfileForm
            key={editingProfile.id}
            profile={editingProfile}
            onChange={handleProfileChange}
          />
        )}

        {error && <p className="text-xs text-destructive">{error.message}</p>}
      </CardContent>
    </Card>
  )
}
