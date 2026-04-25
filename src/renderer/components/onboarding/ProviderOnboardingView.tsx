import { OnboardingProviderProfileForm } from "@renderer/components/onboarding/OnboardingProviderProfileForm"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@renderer/components/ui/card"
import { useCreateProviderProfile } from "@renderer/features/provider-profiles/queries/provider-profiles-query"
import { ProviderProfileInput } from "@shared/provider-profile-types"

export function ProviderOnboardingView() {
  const { mutate: createProviderProfile, isPending } =
    useCreateProviderProfile()

  const handleSubmit = async (values: ProviderProfileInput) => {
    createProviderProfile(values)
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-sm border border-border/60 overflow-visible">
        <CardHeader>
          <CardTitle>Set up your first provider</CardTitle>
          <CardDescription>
            Arena Oracle needs a complete provider profile before chat can be
            used. Save a provider, API key, and model in one step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingProviderProfileForm
            isSubmitting={isPending}
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>
    </div>
  )
}
