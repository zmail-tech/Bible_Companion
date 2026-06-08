#!/usr/bin/env python3
"""Build concordance index - maps Strong's numbers to verse references."""

import sys
from collections import defaultdict

from .types import BOOK_CODES, BuildStats
from .utils import (
    CONCORDANCE_DIR,
    INDEX_PD_DIR,
    ensure_dir,
    format_file_size,
    log,
    read_jsonl,
    write_json,
    write_jsonl,
)


def build_concordance() -> dict[str, list[str]]:
    """Build concordance index mapping Strong's numbers to verse IDs.

    Reads from vector-db/index-pd/bible-index.jsonl and creates a mapping
    of each Strong's number to all verses where it appears.

    Output format (JSON):
    {
        "H1": ["GEN.1.1", "GEN.2.4", ...],
        "H2": ["GEN.4.1", ...],
        "G1": ["MAT.1.1", ...],
        ...
    }
    """
    log("Building concordance index...")

    # Check that the source index exists
    source_path = INDEX_PD_DIR / "bible-index.jsonl"
    if not source_path.exists():
        log("ERROR: PD index not found. Run --index-pd first.")
        log(f"  Expected: {source_path}")
        sys.exit(1)

    # Ensure output directory exists
    ensure_dir(CONCORDANCE_DIR)

    # Load all verses from the PD index
    log("Loading PD index...")
    all_verses = read_jsonl(source_path)
    log(f"  Loaded {len(all_verses)} verses")

    # Build concordance: Strong's number -> list of verse IDs
    log("Building concordance mapping...")
    concordance: dict[str, list[str]] = defaultdict(list)

    for verse in all_verses:
        verse_id = verse["id"]
        strongs_list = verse.get("s", [])

        for strongs in strongs_list:
            concordance[strongs].append(verse_id)

    # Sort Strong's numbers for consistent output
    # Hebrew (H) numbers first, then Greek (G), numerically within each
    def sort_key(s: str) -> tuple[int, int]:
        prefix = 0 if s.startswith("H") else 1
        # Extract numeric part, handle suffixes like "H1a"
        num_str = s[1:].rstrip("abcdefghij")
        suffix = s[1:][len(num_str) :] if len(s[1:]) > len(num_str) else ""
        num = int(num_str) if num_str else 0
        suffix_val = ord(suffix) if suffix else 0
        return (prefix, num, suffix_val)

    sorted_strongs = sorted(concordance.keys(), key=sort_key)
    sorted_concordance = {s: concordance[s] for s in sorted_strongs}

    # Write output as single JSON file
    log("Writing concordance...")
    output_path = CONCORDANCE_DIR / "strongs-to-verses.json"
    write_json(output_path, sorted_concordance)

    # Also write a JSONL version for streaming access
    jsonl_path = CONCORDANCE_DIR / "strongs-to-verses.jsonl"
    jsonl_data = [{"strongs": s, "verses": verses} for s, verses in sorted_concordance.items()]
    write_jsonl(jsonl_path, jsonl_data)

    # Write stats
    total_strongs = len(sorted_concordance)
    hebrew_count = sum(1 for s in sorted_concordance if s.startswith("H"))
    greek_count = sum(1 for s in sorted_concordance if s.startswith("G"))
    total_refs = sum(len(verses) for verses in sorted_concordance.values())

    stats = {
        "total_strongs_numbers": total_strongs,
        "hebrew_strongs": hebrew_count,
        "greek_strongs": greek_count,
        "total_verse_references": total_refs,
        "avg_verses_per_strongs": round(total_refs / total_strongs, 2) if total_strongs else 0,
    }
    stats_path = CONCORDANCE_DIR / "stats.json"
    write_json(stats_path, stats)

    # Log summary
    log("")
    log("=== Concordance Build Complete ===")
    log(f"Total Strong's numbers: {total_strongs}")
    log(f"  Hebrew (H): {hebrew_count}")
    log(f"  Greek (G): {greek_count}")
    log(f"Total verse references: {total_refs}")
    log(f"Average verses per Strong's: {stats['avg_verses_per_strongs']}")

    output_size = output_path.stat().st_size
    log(f"Output file: {output_path}")
    log(f"Output size: {format_file_size(output_size)}")

    return sorted_concordance


def main() -> None:
    """Main entry point."""
    build_concordance()


if __name__ == "__main__":
    main()
