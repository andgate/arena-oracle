# MTGA Player.log & Game Rules Engine (GRE)

## Background on GRE

Wizards of the coast has a great article to get you started on how the GRE works.

https://magic.wizards.com/en/news/mtg-arena/on-whiteboards-naps-and-living-breakthrough

## Player.log Location

| Install Type | Path                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Steam        | `%STEAM%\steamapps\common\MTGA\` (resolved via registry: `HKCU\Software\Valve\Steam` → `SteamPath`) |
| Standalone   | `C:\Program Files\Wizards of the Coast\MTGA\`                                                       |

Log file path: `%APPDATA%\..\LocalLow\Wizards Of The Coast\MTGA\Player.log`

## File Format

- Plain UTF-8 text file
- Each log entry is a single line (no newlines within an entry)
- Lines are prefixed with a `[UnityCrossThreadLogger]` header
- JSON payload begins at the first `{` character on the line
- The file may be truncated/rotated by MTGA — detect this by checking if `curr.size < prev.size`

## Watching the File

Use `fs.watchFile` with a polling interval (500ms works well). Read only new bytes by tracking a `fileOffset` and using `createReadStream` with `start`/`end`. Chunks from the stream do not respect line boundaries, so buffer incoming chunks and split on `\n` before attempting to parse.

## GRE Message Structure

The relevant log lines are `GreToClientEvent` messages. Top level shape:

```json
{
  "transactionId": "...",
  "requestId": 7,
  "timestamp": "...",
  "greToClientEvent": {
    "greToClientMessages": [ ...messages ]
  }
}
```

Each message in `greToClientMessages` has a `type` field used as a discriminator.

## Message Types

### `GREMessageType_GameStateMessage`

The primary message type. Contains a `gameStateMessage` which is always a **diff** (`GameStateType_Diff`), not a full snapshot. Diffs must be applied incrementally to maintain current state.

Key fields:

- `gameStateId` — monotonically increasing, used to detect out-of-order or duplicate messages
- `prevGameStateId` — links to the previous state for ordering
- `turnInfo` — current phase, step, active player, priority player
- `zones` — only zones that changed are included
- `gameObjects` — only objects that changed are included
- `diffDeletedInstanceIds` — instance IDs that should be removed from state
- `players` — player state updates (life total etc)
- `annotations` — describes what happened (zone transfers, taps, damage, etc)
- `systemSeatIds` — identifies which seat is the local player

### Decision Messages

These messages fire when the local player must make a decision. All carry `systemSeatIds: [localSeatId]`. Use `gameStateId` + message type together as a deduplication key — the same decision message can fire multiple times with identical content (observed up to 5 times for `DeclareBlockersReq`).

| Message                              | Trigger                                                                        | Key payload                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GREMessageType_ActionsAvailableReq` | Player has priority — can cast spells, play lands, activate abilities, or pass | `actionsAvailableReq.actions` — full list of legal actions                                                                                                         |
| `GREMessageType_DeclareAttackersReq` | Declare attackers step                                                         | `declareAttackersReq.qualifiedAttackers` — creatures eligible to attack with their legal damage recipients                                                         |
| `GREMessageType_DeclareBlockersReq`  | Declare blockers step                                                          | `declareBlockersReq.blockers` — creatures eligible to block, each with the list of attackers they can block                                                        |
| `GREMessageType_SelectTargetsReq`    | A spell or ability needs targets chosen                                        | `selectTargetsReq.targets` — array of target slots, each with eligible `targetInstanceId` values; `selectTargetsReq.sourceId` — the spell/ability choosing targets |
| `GREMessageType_PayCostsReq`         | A cost must be paid (e.g. modal mana choice)                                   | `payCostsReq.manaCost` — the cost to pay; `payCostsReq.paymentActions` — available mana sources                                                                    |
| `GREMessageType_AssignDamageReq`     | Player must assign combat damage among multiple blockers                       | `assignDamageReq.damageAssigners` — each attacker with `totalDamage` and `assignments` array of targets with min/max damage                                        |
| `GREMessageType_MulliganReq`         | Player must decide to keep or mulligan their opening hand                      | `mulliganReq.mulliganType` (always `"MulliganType_London"`), `mulliganReq.mulliganCount` (absent on first offer, increments each time)                             |
| `GREMessageType_GroupReq`            | Player must sort cards into groups (e.g. London Mulligan bottom selection)     | `groupReq.instanceIds` — the cards being sorted; `groupReq.groupSpecs` — target zones/counts; `groupReq.context` — e.g. `"GroupingContext_LondonMulligan"`         |

### Other Message Types

These are parsed but do not trigger coaching snapshots:

| Message                                  | Description                                                                                                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GREMessageType_PromptReq`               | UI hint, fires for both players (`systemSeatIds: [1, 2]`). Not a decision point.                                                                                                             |
| `GREMessageType_QueuedGameStateMessage`  | Queued state update, same structure as `GameStateMessage`                                                                                                                                    |
| `GREMessageType_ConnectResp`             | Initial connection response. Also signals new game start — reset all state on receipt. Contains deck list in `connectResp.deckMessage.deckCards` (array of grpIds) and GRE/GRP version info. |
| `GREMessageType_SetSettingsResp`         | Settings acknowledgement                                                                                                                                                                     |
| `GREMessageType_DieRollResultsResp`      | Die roll result at game start                                                                                                                                                                |
| `GREMessageType_ChooseStartingPlayerReq` | Who goes first decision                                                                                                                                                                      |
| `GREMessageType_IntermissionReq`         | Between-game intermission                                                                                                                                                                    |

Unknown message types are silently ignored — the GRE message discriminated union includes a passthrough catch-all.

## New Game Detection

A new game can be detected via two signals — both should trigger a full state reset:

1. **`GREMessageType_ConnectResp`** — fires at the very start of each game session, before any game state messages. Most reliable signal.
2. **`gameStateId` reset** — if an incoming `GameStateDiff` has a `gameStateId` ≤ 10 while the current tracked `gameStateId` is significantly higher (e.g. > 50), a new game has started. Use as a fallback in case `ConnectResp` is missed.

## Identifying the Local Player

`systemSeatIds[0]` on any GRE message reliably identifies the local player's seat ID. In practice this is always seat `1` — the local player's messages carry `systemSeatIds: [1]`, and opponent-only messages carry `systemSeatIds: [2]`. `PromptReq` is the exception, carrying both: `systemSeatIds: [1, 2]`.

Set `localPlayerSeatId` from the first message received and never change it.

## Game Object Model

### `instanceId` vs `grpId`

- `grpId` — the card definition ID, links to the MTGA card database. Stable across all copies of the same printing.
- `instanceId` — a unique ID for this specific copy of the card in this game. Changes when a card moves between zones (tracked via `AnnotationType_ObjectIdChanged`).

### Game Object Types

| Type                          | Description                                                                                                                                                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GameObjectType_Card`         | A normal card                                                                                                                                                                                                                                                                |
| `GameObjectType_Token`        | A token permanent. Has `objectSourceGrpId` (the card that created it) and `parentId`. **Tokens have valid, non-zero `grpId` values and are present in the card database** — `lookupCard(grpId)` works normally for tokens.                                                   |
| `GameObjectType_Ability`      | An activated or triggered ability on the stack. Has `objectSourceGrpId` pointing to the source card's grpId and `parentId` pointing to the source permanent's instanceId. **Always use `objectSourceGrpId` for display — the ability's own `grpId` is not the source card.** |
| `GameObjectType_RevealedCard` | A card revealed to the opponent (e.g. bounced back to hand, hand disruption effects). Lives in `ZoneType_Revealed` in its settled state. `uniqueAbilities` entries may omit the `id` field.                                                                                  |

### Game Object Fields

Standard fields present on most objects:

| Field                  | Description                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `instanceId`           | Unique instance in this game                                                                                                        |
| `grpId`                | Card definition ID                                                                                                                  |
| `type`                 | `GameObjectType_*` string                                                                                                           |
| `zoneId`               | Current zone                                                                                                                        |
| `visibility`           | `Visibility_Public`, `Visibility_Private`, or `Visibility_Hidden`                                                                   |
| `ownerSeatId`          | Who owns the card                                                                                                                   |
| `controllerSeatId`     | Who currently controls it (may differ from owner)                                                                                   |
| `cardTypes`            | Array of `CardType_*` values                                                                                                        |
| `power` / `toughness`  | `{ value: number }` — live values reflecting buffs/debuffs. Always prefer over printed values from card DB                          |
| `isTapped`             | Boolean                                                                                                                             |
| `hasSummoningSickness` | Boolean                                                                                                                             |
| `damage`               | Current damage marked on a permanent                                                                                                |
| `attackState`          | `"AttackState_Attacking"` when declared as attacker                                                                                 |
| `blockState`           | `"BlockState_Blocked"` etc                                                                                                          |
| `attackInfo`           | `{ targetId, damageAssigned }` — who the attacker is targeting                                                                      |
| `uniqueAbilities`      | `{ id?, grpId }[]` — instance-specific ability IDs for this permanent. `id` may be absent on `GameObjectType_RevealedCard` objects. |
| `objectSourceGrpId`    | For tokens/abilities: the `grpId` of the card that created them                                                                     |
| `parentId`             | For tokens/abilities: the `instanceId` of the source permanent                                                                      |
| `name`                 | Localization ID (number) — **not a string**. Look up via `Localizations_enUS` table in the card database.                           |

The `GameObject` schema uses `.catchall(z.unknown())` — MTGA adds fields freely across patches and unknown fields are passed through silently.

### Zone Types

| Zone                   | Description                                                                                                                                         | Has `ownerSeatId`                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `ZoneType_Battlefield` | Permanents in play                                                                                                                                  | No — filter by `gameObject.controllerSeatId` |
| `ZoneType_Hand`        | Cards in hand (private)                                                                                                                             | Yes                                          |
| `ZoneType_Library`     | Deck (hidden)                                                                                                                                       | Yes                                          |
| `ZoneType_Graveyard`   | Discard pile                                                                                                                                        | Yes                                          |
| `ZoneType_Exile`       | Exile zone                                                                                                                                          | No — filter by `gameObject.ownerSeatId`      |
| `ZoneType_Stack`       | Spells/abilities on the stack                                                                                                                       | No                                           |
| `ZoneType_Limbo`       | Transitional zone for cards mid-animation. Ignore for game state purposes                                                                           | No                                           |
| `ZoneType_Revealed`    | Cards revealed to the opponent (bounced to hand, hand disruption, etc). Settled state for `GameObjectType_RevealedCard` objects. Has `ownerSeatId`. | Yes                                          |
| `ZoneType_Pending`     | Internal engine zone                                                                                                                                | No                                           |
| `ZoneType_Suppressed`  | Internal engine zone                                                                                                                                | No                                           |
| `ZoneType_Command`     | Command zone (not used in standard)                                                                                                                 | No                                           |
| `ZoneType_Sideboard`   | Sideboard (private)                                                                                                                                 | Yes                                          |

### Visibility

- `Visibility_Public` — both players can see
- `Visibility_Private` — only the owning player can see (hand, sideboard)
- `Visibility_Hidden` — neither player can see (library)

## Mulligan Sequence

The pregame mulligan phase produces the following message sequence before turn 1:

1. `GREMessageType_ConnectResp` — game start, no `gameStateId`
2. `GREMessageType_DieRollResultsResp` — who goes first die roll
3. `GameStateMessage` (gsId=1) — zones initialized, both libraries at 60, hands empty
4. `GameStateMessage` (gsId=2) — both hands dealt (7 cards each), both players get `pendingMessageType: ClientMessageType_MulliganResp`
5. For each mulligan: `GameStateMessage` (new hand dealt) → `GREMessageType_MulliganReq` (systemSeatIds: [1])
6. After accepting: `GREMessageType_GroupReq` with `context: "GroupingContext_LondonMulligan"` — player chooses which cards to put on the bottom. `groupReq.instanceIds` contains all 7 cards; `groupSpecs` defines how many go to hand vs. library bottom.
7. `GameStateMessage` — turn 1 `Phase_Beginning` begins, hand reflects final kept cards

`turnInfo` is absent or empty during mulligan phase — `buildSnapshot` must not require `turnInfo` to be present when the pending decision is `Mulligan` or `LondonMulliganGroup`.

## Turn Structure

Phases and steps observed in the log:

```
Phase_Beginning
  Step_Upkeep
  Step_Draw
Phase_Main1
Phase_Combat
  Step_BeginCombat
  Step_DeclareAttack
  Step_DeclareBlock
  Step_CombatDamage
  Step_EndCombat
Phase_Main2
Phase_Ending
  Step_End
  Step_Cleanup
```

`priorityPlayer` and `activePlayer` are tracked separately — priority passes back and forth between players within each phase/step.

## Player State

Player records use `systemSeatNumber` as the seat identity field (not `seatId`). Both players are present in the very first `GameStateMessage`. Life total changes are sent as diffs whenever damage or life gain occurs.

Key fields: `lifeTotal`, `systemSeatNumber`, `status` (`PlayerStatus_InGame`, `PlayerStatus_PendingLoss`), `startingLifeTotal`, `maxHandSize`, `turnNumber`.

## Action Types

| Action                     | Description                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ActionType_Cast`          | Cast a spell. Includes `manaCost`, optional `targets`, and optional `autoTapSolution` (MTGA's suggested mana payment) |
| `ActionType_Play`          | Play a land                                                                                                           |
| `ActionType_Activate_Mana` | Activate a mana ability. Includes `manaPaymentOptions` and `manaSelections`                                           |
| `ActionType_Activate`      | Activate a non-mana ability                                                                                           |
| `ActionType_Pass`          | Pass priority                                                                                                         |
| `ActionType_FloatMana`     | Float mana                                                                                                            |

`autoTapSolution` on a `Cast` action contains MTGA's suggested automatic mana payment. It is advisory — the player can choose differently.

## Annotations

Annotations describe events that occurred in a state transition. Useful types:

| Annotation                                              | Description                                                                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `AnnotationType_ZoneTransfer`                           | Card moved between zones, includes `zone_src`, `zone_dest`, and `category` (e.g. `"CastSpell"`, `"Resolve"`, `"Draw"`) |
| `AnnotationType_ObjectIdChanged`                        | `instanceId` changed due to zone transition, maps `orig_id` to `new_id`                                                |
| `AnnotationType_TappedUntappedPermanent`                | Permanent tapped or untapped                                                                                           |
| `AnnotationType_ManaPaid`                               | Mana was spent to pay a cost                                                                                           |
| `AnnotationType_ResolutionStart` / `ResolutionComplete` | Spell or ability began/finished resolving                                                                              |
| `AnnotationType_NewTurnStarted`                         | New turn began                                                                                                         |
| `AnnotationType_PhaseOrStepModified`                    | Phase or step changed                                                                                                  |
| `AnnotationType_UserActionTaken`                        | Player took an action                                                                                                  |
| `AnnotationType_EnteredZoneThisTurn`                    | Persistent annotation tracking what entered a zone this turn                                                           |

## Combat State on Game Objects

Attacking creatures have additional fields set directly on their `GameObject` during combat — this information is available from the game state at any time, not only from `DeclareAttackersReq`:

| Field                 | Value                     | Description                                        |
| --------------------- | ------------------------- | -------------------------------------------------- |
| `attackState`         | `"AttackState_Attacking"` | Creature has been declared as an attacker          |
| `blockState`          | `"BlockState_Unblocked"`  | Attacking creature has not been blocked            |
| `attackInfo.targetId` | number                    | The seat ID or permanent instanceId being attacked |

## Mana Actions

`ActionType_FloatMana` always appears in the available actions list but has no practical coaching value and can be ignored.

Dual and multi-color mana sources appear as a **single** `ActionType_Activate_Mana` action with multiple entries in `manaPaymentOptions` and `manaSelections[0].options` — one per color the land can produce. Each option has a `selectedColor` and a `mana` array with the color and count.

## Planeswalkers

Loyalty is tracked inline on the `GameObject`:

- `loyalty: { value: N }` — current loyalty count
- `loyaltyUsed: { value: N }` — whether loyalty ability was used this turn (0 or 1)

Loyalty updates via normal game state diffs. No special annotation processing is needed.

`AnnotationType_LoyaltyActivationsRemaining` appears in annotations when a planeswalker ability is activated — this is a UI hint only, not the loyalty value itself.

## Counters

Counter information appears in `persistentAnnotations` with type `AnnotationType_Counter`:

- `affectedIds[0]` — the `instanceId` of the permanent with the counter
- `details[counter_type]` — integer enum identifying the counter type
- `details[count]` — the **current total** counter count on that permanent

Known counter type values:

| Value | Counter Type            |
| ----- | ----------------------- |
| `1`   | +1/+1                   |
| `7`   | Loyalty (planeswalkers) |

**Important**: persistent counter annotations are **not** carried forward in every diff — they only appear in diffs where the count changes. You cannot read current counter state from a single diff in isolation; you must accumulate them over time.

For coaching purposes, explicit counter tracking is generally unnecessary — the live `power` and `toughness` values on `GameObject` already reflect any +1/+1 counters, and loyalty is available inline.
