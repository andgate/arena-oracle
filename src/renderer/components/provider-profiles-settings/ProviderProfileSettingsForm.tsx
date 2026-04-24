import { FieldGroup } from "@renderer/components/ui/field"
import { useProviderProfileSettings } from "@renderer/features/provider-profiles/hooks/use-provider-profile-settings"
import { useProviderProfilesQuery } from "@renderer/features/provider-profiles/queries/provider-profiles-query"
import { defaultProviderKey } from "@shared/provider-config"
import { useEffect } from "react"
import { ProviderProfileSettingsApiKeyField } from "./ProviderProfileSettingsApiKeyField"
import { ProviderProfileSettingsModelField } from "./ProviderProfileSettingsModelField"
import { ProviderProfileSettingsNameField } from "./ProviderProfileSettingsNameField"
import { ProviderProfileSettingsSelectField } from "./ProviderProfileSettingsSelectField"

export function ProviderProfileSettingsForm() {
  const { data: profiles = {} } = useProviderProfilesQuery()
  const { editingProfileId, setEditingProfileId } = useProviderProfileSettings()

  const sortedProfiles = Object.values(profiles).sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? ""),
  )

  const profile = editingProfileId ? (profiles[editingProfileId] ?? null) : null
  const providerKey = profile?.providerKey ?? defaultProviderKey

  useEffect(() => {
    if (editingProfileId === null && sortedProfiles.length > 0) {
      setEditingProfileId(sortedProfiles[0].id)
    }
  }, [editingProfileId, sortedProfiles, setEditingProfileId])

  return (
    <div className="space-y-4">
      <FieldGroup>
        <ProviderProfileSettingsNameField profiles={sortedProfiles} />

        {profile && (
          <>
            <ProviderProfileSettingsSelectField providerKey={providerKey} />
            <ProviderProfileSettingsApiKeyField
              apiKey={profile.apiKey ?? ""}
              providerKey={providerKey}
            />
            <ProviderProfileSettingsModelField
              selectedModel={profile.selectedModel ?? ""}
              providerKey={providerKey}
              apiKey={profile.apiKey ?? ""}
            />
          </>
        )}
      </FieldGroup>
    </div>
  )
}
