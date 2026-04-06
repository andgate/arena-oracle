import { LoaderIcon } from "lucide-react"

import { cn } from "@renderer/lib/utils"

function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof LoaderIcon>) {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
