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
import { ProviderProfile } from "@shared/provider-profile-types"
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useState } from "react"

type ProfileOption = Pick<ProviderProfile, "id" | "name">

type SettingsProviderProfileNameFieldProps = {
  editingProfileId: string | null
  isBusy?: boolean
  onAcceptDraftName: (name: string) => Promise<void>
  onCreateProfile: () => Promise<ProfileOption>
  onDeleteProfile: () => Promise<void>
  onDiscardCreatedProfile: (
    profileId: string,
    restoreProfileId: string | null,
  ) => Promise<void>
  onSelectProfile: (profileId: string) => void
  profileOptions: ProfileOption[]
}

type NameFieldMode = "normal" | "create" | "edit"

export function SettingsProviderProfileNameField({
  editingProfileId,
  isBusy = false,
  onAcceptDraftName,
  onCreateProfile,
  onDeleteProfile,
  onDiscardCreatedProfile,
  onSelectProfile,
  profileOptions,
}: SettingsProviderProfileNameFieldProps) {
  const [mode, setMode] = useState<NameFieldMode>("normal")
  const [draftName, setDraftName] = useState("")
  const [previousProfileId, setPreviousProfileId] = useState<string | null>(
    null,
  )
  const [createdProfileId, setCreatedProfileId] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const isNormalMode = mode === "normal"
  const currentProfile = profileOptions.find(
    (profile) => profile.id === editingProfileId,
  )
  const canEdit = editingProfileId !== null
  const canDelete = editingProfileId !== null
  const canAcceptDraft = draftName.trim().length > 0
  const isDisabled = isBusy || isPending

  const handleCreate = async () => {
    if (isDisabled) {
      return
    }

    setIsPending(true)

    try {
      const nextProfile = await onCreateProfile()
      setPreviousProfileId(editingProfileId)
      setCreatedProfileId(nextProfile.id)
      setDraftName(nextProfile.name ?? "")
      setMode("create")
    } finally {
      setIsPending(false)
    }
  }

  const handleEdit = () => {
    if (!currentProfile || isDisabled) {
      return
    }

    setPreviousProfileId(editingProfileId)
    setCreatedProfileId(null)
    setDraftName(currentProfile.name ?? "")
    setMode("edit")
  }

  const handleCancel = async () => {
    if (isDisabled) {
      return
    }

    setIsPending(true)

    try {
      if (mode === "create" && createdProfileId) {
        await onDiscardCreatedProfile(createdProfileId, previousProfileId)
      } else if (mode === "edit" && previousProfileId) {
        onSelectProfile(previousProfileId)
      }

      setDraftName("")
      setCreatedProfileId(null)
      setPreviousProfileId(null)
      setMode("normal")
    } finally {
      setIsPending(false)
    }
  }

  const handleAccept = async () => {
    if (isDisabled || !canAcceptDraft) {
      return
    }

    setIsPending(true)

    try {
      await onAcceptDraftName(draftName.trim())
      setCreatedProfileId(null)
      setPreviousProfileId(null)
      setMode("normal")
    } finally {
      setIsPending(false)
    }
  }

  const handleDelete = async () => {
    if (isDisabled || !canDelete) {
      return
    }

    setIsPending(true)

    try {
      await onDeleteProfile()
      setIsDeleteDialogOpen(false)
    } finally {
      setIsPending(false)
    }
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
              onValueChange={onSelectProfile}
              disabled={isDisabled || profileOptions.length === 0}
            >
              <SelectTrigger
                id="settings-provider-profile-name"
                className="w-full"
              >
                <SelectValue placeholder="Select a provider profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {profileOptions.map((profile) => (
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
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Enter profile name"
              disabled={isDisabled}
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
                disabled={isDisabled}
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
                disabled={isDisabled || !canEdit}
                onClick={handleEdit}
              >
                <PencilIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Delete provider profile"
                disabled={isDisabled || !canDelete}
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
                disabled={isDisabled}
                onClick={() => {
                  handleCancel().catch(console.error)
                }}
              >
                <XIcon />
              </Button>
              <Button
                type="button"
                size="icon"
                aria-label="Save profile name"
                disabled={isDisabled || !canAcceptDraft}
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
      {isNormalMode && profileOptions.length === 0 && (
        <FieldDescription>
          Create a provider profile to start configuring a provider.
        </FieldDescription>
      )}

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isDisabled) {
            setIsDeleteDialogOpen(open)
          }
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
            <AlertDialogCancel disabled={isDisabled}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDisabled}
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
