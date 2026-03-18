Pipeline of how we pull coaching snapshots from MTGA:

```
MTGA Process
    |
    | writes to
    v
Player.log
    |
    | fs.watchFile (500ms interval)
    v
player-log-service
    | emits "chunk" (raw string)
    v
log-event-bus
    |
    | listened to by
    v
game-state-service
    | - buffers chunks into lines
    | - parses JSON lines via zod (gre-types)
    | - applies diffs to raw GameState
    | - emits "stateUpdated" / "actionsAvailable"
    v
game-state-event-bus
    |
    | listened to by
    v
coaching-snapshot-service          card-db-service
    | - receives raw GameState            |
    | - for each grpId in gameObjects     |
    |   calls lookupCard(grpId) ----------+
    | - builds CoachingSnapshot
    | - emits "snapshotReady"
    v
coaching-event-bus
    |
    | listened to by
    v
llm-service
    | - only triggers on "actionsAvailable" events
    | - formats CoachingSnapshot into prompt
    | - calls LLM API
    | - receives coaching advice
    | - emits "coachingAdvice"
    v
ipc-bridge
    | - forwards advice to renderer via
    | - win.webContents.send("coaching:advice", advice)
    v
Renderer / UI
    | - displays advice to player
```
