import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@renderer/components/ui/alert-dialog"
import { Button } from "@renderer/components/ui/button"
import {
  Field,
  FieldDescription,
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
import { useProviderProfileSettings } from "@renderer/features/provider-profiles/hooks/use-provider-profile-settings"
import {
  useCreateProviderProfile,
  useDeleteProviderProfile,
  useProviderProfileNameSetter,
} from "@renderer/features/provider-profiles/queries/provider-profiles-query"
import { ProviderProfile } from "@shared/provider-profile-types"
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useState } from "react"

type NameFieldMode = "normal" | "create" | "edit"

type ProviderProfileSettingsNameFieldProps = {
  profiles: ProviderProfile[]
}

export function ProviderProfileSettingsNameField({
  profiles,
}: ProviderProfileSettingsNameFieldProps) {
  const { editingProfileId, setEditingProfileId } = useProviderProfileSettings()
  const createProfile = useCreateProviderProfile()
  const deleteProfile = useDeleteProviderProfile()
  const setName = useProviderProfileNameSetter(editingProfileId)

  const [mode, setMode] = useState<NameFieldMode>("normal")
  const [nameInput, setNameInput] = useState("")
  const [draftProfileId, setDraftProfileId] = useState<string | null>(null)
  const [draftRestoreProfileId, setDraftRestoreProfileId] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const isPending = createProfile.isPending || deleteProfile.isPending || setName.isPending
  const isNormalMode = mode === "normal"
  const canEdit = editingProfileId !== null
  const canSave = nameInput.trim().length > 0
  const currentProfile = profiles.find((p) => p.id === editingProfileId) ?? null

  const handleCreate = async () => {
    if (isPending) return
    const id = await createProfile.mutateAsync(undefined)
    setDraftRestoreProfileId(editingProfileId)
    setDraftProfileId(id)
    setEditingProfileId(id)
    setNameInput("")
    setMode("create")
  }

  const handleRename = () => {
    if (isPending || !currentProfile) return
    setNameInput(currentProfile.name ?? "")
    setMode("edit")
  }

  const handleCancel = async () => {
    if (isPending) return

    if (mode === "create" && draftProfileId !== null) {
      await deleteProfile.mutateAsync(draftProfileId)
      setEditingProfileId(draftRestoreProfileId)
      setDraftProfileId(null)
      setDraftRestoreProfileId(null)
    }

    setNameInput("")
    setMode("normal")
  }

  const handleAccept = async () => {
    if (isPending || !canSave || !editingProfileId) return
    await setName.mutateAsync(nameInput.trim())
    setNameInput("")
    setDraftProfileId(null)
    setDraftRestoreProfileId(null)
    setMode("normal")
  }

  const handleDelete = async () => {
    if (isPending || !editingProfileId) return
    await deleteProfile.mutateAsync(editingProfileId)
    const remaining = profiles.filter((p) => p.id !== editingProfileId)
    setEditingProfileId(remaining[0]?.id ?? null)
  }

  return (
    <Field>
      <FieldLabel htmlFor="settings-provider-profile-name">
        Profile name
      </FieldLabel>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {isNormalMode ? (
            <Select
              value={editingProfileId ?? ""}
              onValueChange={setEditingProfileId}
              disabled={isPending || profiles.length === 0}
            >
              <SelectTrigger
                id="settings-provider-profile-name"
                className="w-full"
              >
                <SelectValue placeholder="Select a provider profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name ?? "untitled"}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="settings-provider-profile-name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Enter profile name"
              disabled={isPending}
            />
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {isNormalMode ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Create provider profile"
                disabled={isPending}
                onClick={() => {
                  handleCreate().catch(console.error)
                }}
              >
                <PlusIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Rename provider profile"
                disabled={isPending || !canEdit}
                onClick={handleRename}
              >
                <PencilIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Delete provider profile"
                disabled={isPending || !canEdit}
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2Icon />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Cancel profile name changes"
                disabled={isPending}
                onClick={() => {
                  handleCancel().catch(console.error)
                }}
              >
                <XIcon />
              </Button>
              <Button
                type="button"
                size="icon"
                aria-label={
                  mode === "create"
                    ? "Create provider profile"
                    : "Save profile name"
                }
                disabled={isPending || !canSave}
                onClick={() => {
                  handleAccept().catch(console.error)
                }}
              >
                <CheckIcon />
              </Button>
            </>
          )}
        </div>
      </div>

      {isNormalMode && profiles.length === 0 && (
        <FieldDescription>
          Create a provider profile to start configuring a provider.
        </FieldDescription>
      )}
      {mode === "create" && (
        <FieldDescription>
          This draft stays local until you accept it.
        </FieldDescription>
      )}

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isPending) setIsDeleteDialogOpen(open)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete provider profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected provider profile and its saved API key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                handleDelete().catch(console.error)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Field>
  )
}
