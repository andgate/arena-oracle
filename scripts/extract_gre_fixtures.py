#!/usr/bin/env python3
"""
extract_gre_fixtures.py

Scans a Player.log file, finds one representative line per GRE message type,
anonymizes identifying info, and writes each to a fixture file.

Usage:
    python extract_gre_fixtures.py Player.log ./tests/fixtures/gre-types/
"""

import json
import re
import sys
import os
import copy
from collections import defaultdict

# ============================================================
# Anonymization
# ============================================================

# Replace grpIds with stable fakes so deck lists aren't leaked.
# We keep the same fake grpId for the same real grpId within a file
# so relationships are preserved.
_grpid_map = {}
_next_fake_grpid = [90000]


def fake_grpid(real: int) -> int:
    if real not in _grpid_map:
        _grpid_map[real] = _next_fake_grpid[0]
        _next_fake_grpid[0] += 1
    return _grpid_map[real]


def anonymize(obj):
    """Recursively walk the parsed JSON and scrub identifying fields."""
    if isinstance(obj, dict):
        result = {}
        for k, v in obj.items():
            # Scrub string fields that look like player names / screen names
            if k in ("playerName", "screenName", "opponentName", "userId", "accountId"):
                result[k] = "ANONYMIZED"
            # Remap grpIds to stable fakes
            elif k == "grpId" and isinstance(v, int):
                result[k] = fake_grpid(v)
            # Remap grpId arrays (e.g. deck card lists)
            elif k in ("deckCards", "sideboardCards") and isinstance(v, list):
                result[k] = [fake_grpid(x) if isinstance(x, int) else x for x in v]
            # Scrub transactionId (contains timestamps/session IDs)
            elif k == "transactionId":
                result[k] = "ANONYMIZED-TRANSACTION-ID"
            # Scrub timestamp
            elif k == "timestamp":
                result[k] = "2024-01-01T00:00:00.000Z"
            else:
                result[k] = anonymize(v)
        return result
    elif isinstance(obj, list):
        return [anonymize(x) for x in obj]
    else:
        return obj


# ============================================================
# Parsing
# ============================================================


def extract_json(line: str):
    """Strip the UnityCrossThreadLogger prefix and parse JSON."""
    idx = line.find("{")
    if idx == -1:
        return None
    try:
        return json.loads(line[idx:])
    except json.JSONDecodeError:
        return None


def is_gre_event(obj: dict) -> bool:
    return (
        isinstance(obj, dict)
        and "greToClientEvent" in obj
        and "greToClientMessages" in obj.get("greToClientEvent", {})
    )


def get_message_types(obj: dict) -> list[str]:
    msgs = obj.get("greToClientEvent", {}).get("greToClientMessages", [])
    return [m.get("type", "UNKNOWN") for m in msgs if isinstance(m, dict)]


# ============================================================
# Main
# ============================================================


def main():
    if len(sys.argv) < 3:
        print("Usage: python extract_gre_fixtures.py <Player.log> <output_dir>")
        sys.exit(1)

    log_path = sys.argv[1]
    out_dir = sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)

    # We want one representative line per message type.
    # If a batch contains multiple message types, it counts for all of them.
    # Priority: prefer lines where the batch contains ONLY that message type
    # (cleaner fixtures). Fall back to mixed batches if needed.

    best: dict[str, dict] = {}  # type -> best single-type obj
    fallback: dict[str, dict] = {}  # type -> first mixed-batch obj
    type_counts: dict[str, int] = defaultdict(int)
    lines_scanned = 0
    gre_lines = 0

    print(f"Scanning {log_path} ...")

    with open(log_path, "r", encoding="utf-8", errors="replace") as f:
        for raw_line in f:
            lines_scanned += 1
            line = raw_line.rstrip("\n")
            obj = extract_json(line)
            if obj is None or not is_gre_event(obj):
                continue

            gre_lines += 1
            types = get_message_types(obj)
            is_single = len(types) == 1

            for t in types:
                type_counts[t] += 1
                if is_single and t not in best:
                    best[t] = copy.deepcopy(obj)
                elif not is_single and t not in fallback:
                    fallback[t] = copy.deepcopy(obj)

    print(f"Scanned {lines_scanned} lines, found {gre_lines} GRE event lines.")
    print(f"Unique message types found: {len(type_counts)}\n")

    # Print a summary table
    print(f"{'Message Type':<50} {'Count':>6}  {'Has clean fixture?'}")
    print("-" * 75)
    all_types = sorted(type_counts.keys())
    for t in all_types:
        has_clean = (
            "✓ clean" if t in best else ("~ mixed" if t in fallback else "✗ none")
        )
        print(f"  {t:<48} {type_counts[t]:>6}  {has_clean}")

    print()

    # Write fixtures
    written = []
    skipped = []
    for t in all_types:
        obj = best.get(t) or fallback.get(t)
        if obj is None:
            skipped.append(t)
            continue

        anon = anonymize(obj)

        # Filename: strip "GREMessageType_" prefix, convert to kebab-case
        base = t.replace("GREMessageType_", "")
        # CamelCase -> kebab-case
        kebab = re.sub(r"(?<!^)(?=[A-Z])", "-", base).lower()
        filename = f"{kebab}.log"
        filepath = os.path.join(out_dir, filename)

        # Write as a single line with the UnityCrossThreadLogger prefix
        # to match real log format exactly
        line_out = "[UnityCrossThreadLogger]" + json.dumps(anon, separators=(",", ":"))

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(line_out + "\n")

        written.append((t, filename))

    # Also write a mixed-batch fixture if we have any mixed batches
    # (tests the case where greToClientMessages has multiple messages)
    mixed_candidates = {
        t: obj for t, obj in fallback.items() if len(get_message_types(obj)) > 1
    }
    if mixed_candidates:
        # Pick the one with the most message types in the batch
        richest = max(
            mixed_candidates.values(), key=lambda o: len(get_message_types(o))
        )
        anon = anonymize(richest)
        filepath = os.path.join(out_dir, "mixed-batch.log")
        line_out = "[UnityCrossThreadLogger]" + json.dumps(anon, separators=(",", ":"))
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(line_out + "\n")
        types_in_batch = get_message_types(richest)
        print(
            f"Wrote mixed-batch.log ({len(types_in_batch)} messages: {', '.join(types_in_batch)})"
        )

    print(f"\nWrote {len(written)} fixture files to {out_dir}:")
    for t, fn in written:
        print(f"  {fn}  ←  {t}")

    if skipped:
        print(f"\nSkipped (no line found): {skipped}")

    # Print grpId mapping so you can verify nothing sensitive leaked
    print(f"\ngrpId mapping ({len(_grpid_map)} cards remapped):")
    print("  (real grpIds are not shown — mapping is one-way)")
    print(
        f"  Fake grpIds used: {min(_grpid_map.values())} – {max(_grpid_map.values()) if _grpid_map else 'N/A'}"
    )


if __name__ == "__main__":
    main()
