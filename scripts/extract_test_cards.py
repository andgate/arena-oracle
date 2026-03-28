#!/usr/bin/env python3
"""
extract_test_cards.py

Extracts a small set of representative cards from the MTGA card database
into a trimmed SQLite fixture file for use in unit tests.

Usage:
    python extract_test_cards.py --input "Raw_CardDatabase_abc123.mtga"
    python extract_test_cards.py --input "Raw_CardDatabase_abc123.mtga" --output "test_card.db"
"""

import argparse
import sqlite3
import os

# A hand-picked set of GrpIds covering the interesting cases:
#   - Creature with P/T and mana ability
#   - Instant with no P/T
#   - Colorless artifact with no colors or P/T
#   - Basic land with no colors, P/T, or abilities
#   - Multicolor creature with multiple abilities
FIXTURE_GRP_IDS = [
    75570,  # Llanowar Elves
    80872,  # Lightning Bolt
    79416,  # Arcane Signet
    65363,  # Plains
    87848,  # Bloodbraid Elf
]

TABLES = [
    "Cards",
    "Localizations_enUS",
    "Abilities",
    "AltPrintings",
    "AltToBasePrintings",
    "Enums",
]


def copy_schema(src: sqlite3.Connection, dst: sqlite3.Connection):
    """Copy CREATE TABLE statements from src to dst."""
    cur = src.execute(
        "SELECT name, sql FROM sqlite_master WHERE type='table' AND name IN ({})".format(
            ",".join("?" * len(TABLES))
        ),
        TABLES,
    )
    for name, sql in cur.fetchall():
        if sql:
            dst.execute(sql)
    dst.commit()


def extract(src_path: str, dst_path: str):
    if os.path.exists(dst_path):
        os.remove(dst_path)

    src = sqlite3.connect(src_path)
    dst = sqlite3.connect(dst_path)

    src.row_factory = sqlite3.Row
    copy_schema(src, dst)

    placeholders = ",".join("?" * len(FIXTURE_GRP_IDS))

    # ── Cards ────────────────────────────────────────────────────────────────
    cards = src.execute(
        f"SELECT * FROM Cards WHERE GrpId IN ({placeholders})", FIXTURE_GRP_IDS
    ).fetchall()
    dst.executemany(
        f"INSERT INTO Cards VALUES ({','.join('?' * len(cards[0]))})",
        [tuple(r) for r in cards],
    )
    print(f"  Cards:              {len(cards)} rows")

    # Collect all the LocIds we'll need from Localizations_enUS
    loc_ids = set()
    ability_ids = set()
    for card in cards:
        for col in ("TitleId", "TypeTextId", "SubtypeTextId"):
            val = card[col]
            if val:
                loc_ids.add(val)
        if card["AbilityIds"]:
            for pair in card["AbilityIds"].split(","):
                aid = pair.split(":")[0].strip()
                if aid:
                    ability_ids.add(int(aid))

    # ── Abilities ────────────────────────────────────────────────────────────
    ability_rows = []
    if ability_ids:
        ab_placeholders = ",".join("?" * len(ability_ids))
        ability_rows = src.execute(
            f"SELECT * FROM Abilities WHERE Id IN ({ab_placeholders})",
            list(ability_ids),
        ).fetchall()
        for row in ability_rows:
            if row["TextId"]:
                loc_ids.add(row["TextId"])
        dst.executemany(
            f"INSERT INTO Abilities VALUES ({','.join('?' * len(ability_rows[0]))})",
            [tuple(r) for r in ability_rows],
        )
    print(f"  Abilities:          {len(ability_rows)} rows")

    # ── Localizations_enUS ───────────────────────────────────────────────────
    loc_rows = []
    if loc_ids:
        loc_placeholders = ",".join("?" * len(loc_ids))
        loc_rows = src.execute(
            f"SELECT * FROM Localizations_enUS WHERE LocId IN ({loc_placeholders})",
            list(loc_ids),
        ).fetchall()
        dst.executemany(
            f"INSERT INTO Localizations_enUS VALUES ({','.join('?' * len(loc_rows[0]))})",
            [tuple(r) for r in loc_rows],
        )
    print(f"  Localizations_enUS: {len(loc_rows)} rows")

    # ── AltPrintings / AltToBasePrintings ────────────────────────────────────
    for table in ("AltPrintings", "AltToBasePrintings"):
        try:
            if table == "AltPrintings":
                rows = src.execute(
                    f"SELECT * FROM {table} WHERE BaseGrpId IN ({placeholders}) OR AltGrpId IN ({placeholders})",
                    FIXTURE_GRP_IDS * 2,
                ).fetchall()
            else:
                rows = src.execute(
                    f"SELECT * FROM {table} WHERE GrpId IN ({placeholders})",
                    FIXTURE_GRP_IDS,
                ).fetchall()
            if rows:
                dst.executemany(
                    f"INSERT INTO {table} VALUES ({','.join('?' * len(rows[0]))})",
                    [tuple(r) for r in rows],
                )
            print(f"  {table+':':<28}{len(rows)} rows")
        except sqlite3.OperationalError as e:
            print(f"  {table}: skipped ({e})")

    # ── Enums (full copy — it's small) ───────────────────────────────────────
    try:
        enum_rows = src.execute("SELECT * FROM Enums").fetchall()
        if enum_rows:
            dst.executemany(
                f"INSERT INTO Enums VALUES ({','.join('?' * len(enum_rows[0]))})",
                [tuple(r) for r in enum_rows],
            )
        print(f"  Enums:              {len(enum_rows)} rows")
    except sqlite3.OperationalError as e:
        print(f"  Enums: skipped ({e})")

    dst.commit()
    src.close()
    dst.close()

    size_kb = os.path.getsize(dst_path) / 1024
    print(f"\nWrote {dst_path} ({size_kb:.1f} KB)")


def main():
    parser = argparse.ArgumentParser(
        description="Extract test fixture cards from MTGA card DB."
    )
    parser.add_argument(
        "--input", required=True, help="Path to the source Raw_CardDatabase_*.mtga file"
    )
    parser.add_argument(
        "--output", default="test_card.db", help="Output path (default: test_card.db)"
    )
    args = parser.parse_args()

    print(f"Source: {args.input}")
    print(f"Output: {args.output}")
    print(f"GrpIds: {FIXTURE_GRP_IDS}\n")
    print("Extracting...")
    extract(args.input, args.output)


if __name__ == "__main__":
    main()
