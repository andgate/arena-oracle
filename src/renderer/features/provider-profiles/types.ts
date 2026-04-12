import { providerKeys } from "@shared/provider-profile-types"
import { z } from "zod"

export const providerProfileFormSchema = z.object({
  name: z.string().trim().min(1, "Profile name is required."),
  providerKey: z.enum(providerKeys),
  apiKey: z.string().trim().min(1, "API key is required."),
  selectedModel: z.string().trim().min(1, "Model is required."),
})

export type ProviderProfileFormValues = z.infer<
  typeof providerProfileFormSchema
>
