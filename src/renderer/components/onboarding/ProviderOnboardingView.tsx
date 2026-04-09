import { OnboardingProviderProfileForm } from "@renderer/components/onboarding/OnboardingProviderProfileForm"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@renderer/components/ui/card"
import { useProviders } from "@renderer/hooks/use-providers"
import { ProviderProfileInput } from "@shared/electron-types"
import { useState } from "react"

export function ProviderOnboardingView() {
  const { addProfile } = useProviders()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (values: ProviderProfileInput) => {
    setIsSubmitting(true)

    try {
      await addProfile(values)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-2xl border border-border/60">
        <CardHeader>
          <CardTitle>Set up your first provider</CardTitle>
          <CardDescription>
            Arena Oracle needs a complete provider profile before chat can be
            used. Save a provider, API key, and model in one step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingProviderProfileForm
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>
    </div>
  )
}
