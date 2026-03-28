# Generating the CardDbService Test Fixture

The test fixture `test_card.db` is a trimmed SQLite database extracted from a real
MTGA card database. It contains a small set of representative cards covering the
meaningful edge cases for `CardDbService`.

## When to Regenerate

- An MTGA patch changes the database schema (new columns, renamed tables, etc.)
- A bug is reported that involves a card type not covered by the current fixture
- The fixture cards are no longer present in the live MTGA database

## Prerequisites

- Python 3.x
- A copy of the MTGA card database (`Raw_CardDatabase_*.mtga`) in the project root
  - Located in your MTGA installation at:
    `%STEAM%\steamapps\common\MTGA\MTGA_Data\Downloads\Raw\`
  - Despite the `.mtga` extension it is a standard SQLite file

## Running the Script

From the project root:

```bash
python scripts/extract_test_cards.py --input Raw_CardDatabase_<hash>.mtga
```

This writes `test_card.db` to the project root. Then move it into place:

```bash
mv test_card.db src/main/services/card-db/__fixtures__/test_card.db
```

## Fixture Cards

The script extracts the following cards, chosen to cover distinct code paths in
`CardDbService`:

| GrpId | Name           | Covers                                      |
| ----- | -------------- | ------------------------------------------- |
| 75570 | Llanowar Elves | Green creature, P/T present, mana ability   |
| 80872 | Lightning Bolt | Red instant, no P/T                         |
| 79416 | Arcane Signet  | Colorless artifact, no P/T, no colors       |
| 65363 | Plains         | Basic land, no colors, no P/T, no abilities |
| 87848 | Bloodbraid Elf | Multicolor (R/G), multiple abilities        |

## AbilityIds Format

The `AbilityIds` column uses the format:

```
abilityId:localizationId,abilityId:localizationId,...
```

The script extracts only the left side of each `:` pair as the ability ID.
The `Abilities` table is then queried by those IDs and the corresponding
`Localizations_enUS` rows are pulled transitively.

## Updating the Fixture Card List

If you need to add or replace cards, query the real database to find valid GrpIds:

```sql
-- Find a card by name
SELECT c.GrpId, name.Loc AS Name, c.Colors, c.Power, c.Toughness, c.AbilityIds, c.Rarity
FROM Cards c
JOIN Localizations_enUS name ON c.TitleId = name.LocId
WHERE name.Loc = 'Card Name Here'
AND c.IsPrimaryCard = 1;

-- Find multicolor cards with abilities
SELECT c.GrpId, name.Loc AS Name, c.Colors, c.Power, c.Toughness, c.AbilityIds, c.Rarity
FROM Cards c
JOIN Localizations_enUS name ON c.TitleId = name.LocId
WHERE c.Colors LIKE '%,%'
AND c.IsPrimaryCard = 1
AND c.AbilityIds != ''
LIMIT 10;
```

Then add the GrpId to the `FIXTURE_GRP_IDS` list in `scripts/extract_test_cards.py`
and re-run the script.
