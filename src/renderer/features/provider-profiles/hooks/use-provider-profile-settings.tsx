import { createContext, useContext, useState } from "react"

type ProviderProfileSettingsContextValue = {
  editingProfileId: string | null
  setEditingProfileId: (id: string | null) => void
}

const ProviderProfileSettingsContext =
  createContext<ProviderProfileSettingsContextValue | null>(null)

export function ProviderProfileSettingsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)

  return (
    <ProviderProfileSettingsContext.Provider
      value={{ editingProfileId, setEditingProfileId }}
    >
      {children}
    </ProviderProfileSettingsContext.Provider>
  )
}

export function useProviderProfileSettings(): ProviderProfileSettingsContextValue {
  const context = useContext(ProviderProfileSettingsContext)
  if (!context) {
    throw new Error(
      "useProviderProfileSettings must be used within a ProviderProfileSettingsProvider",
    )
  }
  return context
}
