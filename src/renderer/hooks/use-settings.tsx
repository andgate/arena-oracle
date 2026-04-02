import { AppSettings } from "@shared/electron-types"
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"

interface UseSettingsResult {
  error: Error | null
  isLoading: boolean
  settings: AppSettings | null
  setAlwaysOnTop: (value: boolean) => Promise<void>
  setDeveloperMode: (value: boolean) => Promise<void>
}

const SettingsContext = createContext<UseSettingsResult | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [settings, setLocalSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    let isMounted = true

    window.mtgaAPI.settings
      .get()
      .then((nextSettings) => {
        if (!isMounted) {
          return
        }

        setLocalSettings(nextSettings)
        setError(null)
      })
      .catch((nextError: unknown) => {
        if (!isMounted) {
          return
        }

        setError(
          nextError instanceof Error
            ? nextError
            : new Error("Failed to load settings."),
        )
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const setAlwaysOnTop = async (value: boolean) => {
    await window.mtgaAPI.settings.setAlwaysOnTop(value)
    setLocalSettings((current) =>
      current ? { ...current, alwaysOnTop: value } : current,
    )
    setError(null)
  }

  const setDeveloperMode = async (value: boolean) => {
    await window.mtgaAPI.settings.setDeveloperMode(value)
    setLocalSettings((current) =>
      current ? { ...current, developerMode: value } : current,
    )
    setError(null)
  }

  return (
    <SettingsContext.Provider
      value={{
        error,
        isLoading,
        settings,
        setAlwaysOnTop,
        setDeveloperMode,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): UseSettingsResult {
  const context = useContext(SettingsContext)

  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider.")
  }

  return context
}
