import { SettingsProviderProfileForm } from "@renderer/components/settings/SettingsProviderProfileForm"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@renderer/components/ui/card"
import { useProviders } from "@renderer/hooks/use-providers"
import { defaultProviderKey } from "@shared/provider-config"
import { ProviderProfileInput } from "@shared/provider-profile-types"
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
  const editingProfile = editingProfileId
    ? (profiles[editingProfileId] ?? null)
    : null

  const handleProfileChange = (updates: ProviderProfileInput) => {
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
    return newProfile
  }

  const getFallbackProfileId = (
    removedProfileId: string,
    preferredProfileId: string | null = null,
  ) => {
    const remainingProfiles = sortedProfiles.filter(
      (profile) => profile.id !== removedProfileId,
    )

    if (
      preferredProfileId &&
      remainingProfiles.some((profile) => profile.id === preferredProfileId)
    ) {
      return preferredProfileId
    }

    return remainingProfiles[0]?.id ?? null
  }

  const handleDelete = async (profileId: string) => {
    if (!profileId) {
      return
    }

    const fallbackId = getFallbackProfileId(profileId)
    await removeProfile(profileId)
    setEditingProfileId(fallbackId)
  }

  const handleDiscardCreatedProfile = async (
    profileId: string,
    restoreProfileId: string | null,
  ) => {
    const fallbackId = getFallbackProfileId(profileId, restoreProfileId)
    await removeProfile(profileId)
    setEditingProfileId(fallbackId)
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Providers</CardTitle>
          <CardDescription>
            Manage saved provider profiles for chat.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <SettingsProviderProfileForm
          editingProfileId={editingProfileId}
          isLoading={isLoading}
          onCreateProfile={handleNew}
          onDeleteProfile={() => handleDelete(editingProfileId ?? "")}
          onDiscardCreatedProfile={handleDiscardCreatedProfile}
          onSelectProfile={setEditingProfileId}
          profile={editingProfile}
          profiles={sortedProfiles}
          onChange={handleProfileChange}
        />

        {error && <p className="text-xs text-destructive">{error.message}</p>}
      </CardContent>
    </Card>
  )
}
