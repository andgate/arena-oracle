import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@renderer/components/ui/tabs"
import { CardDbViewer } from "./CardDbViewer"
import { CoachingViewer } from "./CoachingViewer"
import { GameStateViewer } from "./GameStateViewer"
import { PlayerLogViewer } from "@renderer/components/player-log/PlayerLogViewer"

export function DebugViews() {
  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col items-center md:pt-32">
      <Tabs defaultValue="log" className="w-full max-w-lg">
        <TabsList>
          <TabsTrigger value="log">Raw Log</TabsTrigger>
          <TabsTrigger value="game-state">Game State</TabsTrigger>
          <TabsTrigger value="card-db">Card DB</TabsTrigger>
          <TabsTrigger value="coaching">Coaching</TabsTrigger>
        </TabsList>

        <TabsContent value="log">
          <PlayerLogViewer />
        </TabsContent>

        <TabsContent value="game-state">
          <GameStateViewer />
        </TabsContent>

        <TabsContent value="card-db">
          <CardDbViewer />
        </TabsContent>

        <TabsContent value="coaching">
          <CoachingViewer />
        </TabsContent>
      </Tabs>
    </div>
  )
}
