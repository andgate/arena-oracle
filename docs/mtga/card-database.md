# MTGA Card Database

## File Location

The card database is a SQLite file located in the MTGA installation's `Downloads\Raw` folder:

```
%STEAM%\steamapps\common\MTGA\MTGA_Data\Downloads\Raw\Raw_CardDatabase_<hash>.mtga
```

The filename contains a hash that changes with every MTGA patch. At runtime, scan the directory for a file matching `Raw_CardDatabase_*.mtga`.

Despite the `.mtga` extension, the file is a standard SQLite database and can be opened with any SQLite tool or driver. Use `better-sqlite3` in Node/Electron.

## Finding the File

Steam install path is resolved via the Windows registry:

```
HKCU\Software\Valve\Steam → SteamPath
```

Then append: `steamapps\common\MTGA\MTGA_Data\Downloads\Raw`

Fallback hardcoded paths for non-registry cases:

```
C:\Program Files\Wizards of the Coast\MTGA\MTGA_Data\Downloads\Raw
C:\Program Files (x86)\Wizards of the Coast\MTGA\MTGA_Data\Downloads\Raw
C:\Program Files (x86)\Steam\steamapps\common\MTGA\MTGA_Data\Downloads\Raw
C:\Program Files\Steam\steamapps\common\MTGA\MTGA_Data\Downloads\Raw
```

## Key Tables

### `Cards`

Primary card data. `GrpId` is the primary key and matches the `grpId` field in GRE game objects.

| Column              | Type    | Description                                                                                  |
| ------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `GrpId`             | INT     | Primary key. Matches `grpId` in GRE log                                                      |
| `TitleId`           | INT     | Foreign key into `Localizations_enUS` for card name                                          |
| `TypeTextId`        | INT     | Foreign key into `Localizations_enUS` for pre-rendered type line e.g. `"Legendary Creature"` |
| `SubtypeTextId`     | INT     | Foreign key into `Localizations_enUS` for pre-rendered subtype line e.g. `"Elf Druid"`       |
| `OldSchoolManaText` | TEXT    | Encoded mana cost e.g. `o2oGoG` → `{2}{G}{G}`                                                |
| `Colors`            | TEXT    | Comma-separated color enum values e.g. `"1,2"`                                               |
| `Types`             | TEXT    | Comma-separated type enum values e.g. `"2"`                                                  |
| `Subtypes`          | TEXT    | Comma-separated subtype enum values e.g. `"27,23"`                                           |
| `Power`             | TEXT    | Printed power, string to support `*` values                                                  |
| `Toughness`         | TEXT    | Printed toughness, string to support `*` values                                              |
| `Rarity`            | INT     | 1=Common, 2=Uncommon, 3=Rare, 4=Mythic Rare                                                  |
| `ExpansionCode`     | TEXT    | Set code e.g. `"MKM"`                                                                        |
| `IsPrimaryCard`     | BOOLEAN | False for alt-art and reprint variants                                                       |
| `AbilityIds`        | TEXT    | Comma-separated ability IDs, foreign keys into `Abilities`                                   |
| `CollectorNumber`   | TEXT    | Collector number within set                                                                  |

### `Localizations_enUS`

English language strings for all text in the game. Used for card names, type lines, subtype lines, and ability text.

| Column      | Type | Description                                                                       |
| ----------- | ---- | --------------------------------------------------------------------------------- |
| `LocId`     | INT  | Primary key, referenced by `TitleId`, `TypeTextId`, `SubtypeTextId`, `TextId` etc |
| `Formatted` | INT  | Unknown purpose, multiple rows per `LocId` may exist — use `LIMIT 1`              |
| `Loc`       | TEXT | The human-readable string                                                         |

Additional locale tables follow the same schema: `Localizations_ptBR`, `Localizations_frFR`, `Localizations_itIT`, `Localizations_deDE`, `Localizations_esES`, `Localizations_jaJP`, `Localizations_koKR`, `Localizations_phyrexian`.

### `Abilities`

Ability definitions referenced by `Cards.AbilityIds`.

| Column   | Type | Description                                            |
| -------- | ---- | ------------------------------------------------------ |
| `Id`     | INT  | Primary key, matches values in `Cards.AbilityIds`      |
| `TextId` | INT  | Foreign key into `Localizations_enUS` for ability text |

Ability text uses two placeholder conventions that need decoding:

- `CARDNAME` — replace with the card's name
- Mana symbols encoded as `{oX}` e.g. `{oT}` = tap, `{o1}` = `{1}`, `{oW}` = `{W}`

### `Enums`

Maps integer enum values to localization IDs. Contains types: `CardColor`, `CardType`, `Color`, `SubType`, `SuperType`, `CounterType`, `Phase`, `Step`, and others.

Note: The `Enums.LocId` → `Localizations_enUS.LocId` join does not work reliably. Use the hardcoded mappings below instead.

### `AltPrintings` / `AltToBasePrintings`

Maps alternate art and reprint `GrpId` values back to their base card. Useful if you need to normalize all printings of a card to a single canonical entry.

## Hardcoded Enum Mappings

### Colors (`Cards.Colors`)

| Value | Color     |
| ----- | --------- |
| `1`   | White     |
| `2`   | Blue      |
| `3`   | Black     |
| `4`   | Red       |
| `5`   | Green     |
| empty | Colorless |

### Card Types (`Cards.Types`)

| Value | Type         |
| ----- | ------------ |
| `1`   | Artifact     |
| `2`   | Creature     |
| `3`   | Enchantment  |
| `4`   | Instant      |
| `5`   | Land         |
| `6`   | Phenomenon   |
| `7`   | Plane        |
| `8`   | Planeswalker |
| `9`   | Scheme       |
| `10`  | Sorcery      |
| `11`  | Tribal       |
| `13`  | Vanguard     |
| `14`  | Dungeon      |

### Rarity (`Cards.Rarity`)

| Value | Rarity      |
| ----- | ----------- |
| `1`   | Common      |
| `2`   | Uncommon    |
| `3`   | Rare        |
| `4`   | Mythic Rare |

## Mana Cost Encoding

`OldSchoolManaText` encodes mana costs using `o` as a delimiter followed by the symbol:

| Encoded | Decoded                              |
| ------- | ------------------------------------ |
| `oW`    | `{W}`                                |
| `oU`    | `{U}`                                |
| `oB`    | `{B}`                                |
| `oR`    | `{R}`                                |
| `oG`    | `{G}`                                |
| `o1`    | `{1}`                                |
| `o2`    | `{2}`                                |
| `oX`    | `{X}`                                |
| `oT`    | `{T}` (tap, appears in ability text) |
| `oC`    | `{C}` (colorless)                    |

Decode by splitting on `o`, filtering empty strings, and wrapping each token in `{}`.

## Recommended Query

```sql
SELECT
  c.GrpId,
  c.OldSchoolManaText,
  c.Colors,
  c.Power,
  c.Toughness,
  c.Rarity,
  c.ExpansionCode,
  c.IsPrimaryCard,
  c.AbilityIds,
  name.Loc      AS Name,
  typeLine.Loc  AS TypeLine,
  subtype.Loc   AS SubtypeLine
FROM Cards c
JOIN Localizations_enUS name      ON c.TitleId       = name.LocId
JOIN Localizations_enUS typeLine  ON c.TypeTextId     = typeLine.LocId
LEFT JOIN Localizations_enUS subtype ON c.SubtypeTextId = subtype.LocId
WHERE c.GrpId = ?
LIMIT 1
```

The `LEFT JOIN` on `SubtypeTextId` is intentional — lands and some other card types have no subtypes and the join would otherwise exclude them.

## Caching

Card lookups should be cached in a `Map<number, ResolvedCard>` after the first query. The database is read-only and does not change during a game session. The cache should be cleared when the database file is reloaded (i.e. after an MTGA patch).

## Important Notes

- **Do not use MTGJSON** — it does not map MTGA `grpId` values
- **The file changes on every MTGA patch** — scan for `Raw_CardDatabase_*.mtga` at runtime, never hardcode the filename
- **`IsPrimaryCard`** — multiple `GrpId` values can map to the same card name (different art, different sets). For coaching purposes this doesn't matter since we resolve via `grpId` from the live game object
- **Power and Toughness on the battlefield** — always prefer the live `power`/`toughness` values from the GRE game object over the printed values from the database, as they reflect current buffs and debuffs
