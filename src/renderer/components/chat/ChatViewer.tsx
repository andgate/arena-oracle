import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@renderer/components/ui/alert-dialog"
import { useChatContext } from "./ChatProvider"
import { ChatPromptBar } from "./ChatPromptBar"
import { ChatMessageScreen } from "./ChatMessageScreen"

export function ChatViewer() {
  const { dismissError, errorMessage } = useChatContext()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <ChatMessageScreen />

      <ChatPromptBar />

      <AlertDialog
        open={errorMessage !== null}
        onOpenChange={(open) => {
          if (!open) dismissError()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chat unavailable</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={dismissError}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
