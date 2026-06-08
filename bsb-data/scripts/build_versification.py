#!/usr/bin/env python3
"""Build versification mapping data from UBS Paratext versification JSON."""

import re
import sys

from .types import BOOK_CODES
from .utils import (
    VERSIFICATION_DIR,
    VERSIFICATION_DIR_SRC,
    ensure_dir,
    format_file_size,
    log,
    read_json,
    write_json,
    write_jsonl,
)

VALID_BOOK_CODES = set(BOOK_CODES.values())

# Versification traditions to process
TRADITIONS = {
    "eng": "English (NRSV/KJV standard)",
    "lxx": "Septuagint (Greek OT)",
    "vul": "Vulgate (Latin)",
    "org": "Original (Hebrew/Greek)",
}


def parse_verse_ref(ref: str) -> tuple[str, int, int] | None:
    """Parse 'GEN 31:55' or 'GEN 32:1' into (book, chapter, verse).

    Returns None if the book is not in our 66-book canon.
    """
    match = re.match(r"^([A-Z0-9]+)\s+(\d+):(\d+)$", ref)
    if not match:
        return None
    book, chapter, verse = match.groups()
    if book not in VALID_BOOK_CODES:
        return None
    return book, int(chapter), int(verse)


def parse_verse_range(ref: str) -> tuple[str, int, int, int] | None:
    """Parse 'GEN 32:1-32' into (book, chapter, start_verse, end_verse).

    Also handles single verse 'GEN 31:55' -> (book, chapter, 55, 55).
    Returns None if the book is not in our 66-book canon.
    """
    # Range: BOOK CH:V1-V2
    match = re.match(r"^([A-Z0-9]+)\s+(\d+):(\d+)-(\d+)$", ref)
    if match:
        book, chapter, v_start, v_end = match.groups()
        if book not in VALID_BOOK_CODES:
            return None
        return book, int(chapter), int(v_start), int(v_end)

    # Single verse: BOOK CH:V
    match = re.match(r"^([A-Z0-9]+)\s+(\d+):(\d+)$", ref)
    if match:
        book, chapter, verse = match.groups()
        if book not in VALID_BOOK_CODES:
            return None
        return book, int(chapter), int(verse), int(verse)

    return None


def expand_mapping(eng_ref: str, other_ref: str) -> list[dict]:
    """Expand a verse mapping into individual verse-level mappings.

    Handles both single verses and ranges:
        'GEN 31:55' -> 'GEN 32:1'  (single)
        'GEN 32:1-32' -> 'GEN 32:2-33'  (range with offset)
        'EXO 8:1-4' -> 'EXO 7:26-29'  (range crossing chapters)
    """
    eng_parsed = parse_verse_range(eng_ref)
    other_parsed = parse_verse_range(other_ref)

    if not eng_parsed or not other_parsed:
        return []

    eng_book, eng_ch, eng_start, eng_end = eng_parsed
    other_book, other_ch, other_start, other_end = other_parsed

    mappings = []

    # For single verse mappings
    if eng_start == eng_end and other_start == other_end:
        mappings.append({
            "eng": f"{eng_book}.{eng_ch}.{eng_start}",
            "other": f"{other_book}.{other_ch}.{other_start}",
        })
        return mappings

    # For range mappings, expand verse by verse
    eng_count = eng_end - eng_start + 1
    other_count = other_end - other_start + 1

    if eng_count == other_count:
        # 1:1 mapping across the range
        for i in range(eng_count):
            mappings.append({
                "eng": f"{eng_book}.{eng_ch}.{eng_start + i}",
                "other": f"{other_book}.{other_ch}.{other_start + i}",
            })
    else:
        # Different counts - store as range mapping without expansion
        mappings.append({
            "eng": f"{eng_book}.{eng_ch}.{eng_start}-{eng_end}",
            "other": f"{other_book}.{other_ch}.{other_start}-{other_end}",
        })

    return mappings


def process_tradition(name: str, data: dict) -> dict:
    """Process a versification tradition into our output format."""
    # Max verses per chapter (filtered to our 66 books)
    max_verses = {}
    for book, chapters in data.get("maxVerses", {}).items():
        if book in VALID_BOOK_CODES:
            max_verses[book] = [int(v) for v in chapters]

    # Verse mappings (English <-> this tradition)
    raw_mappings = data.get("mappedVerses", {})
    verse_mappings = []
    skipped = 0

    for eng_ref, other_ref in raw_mappings.items():
        expanded = expand_mapping(eng_ref, other_ref)
        if expanded:
            verse_mappings.extend(expanded)
        else:
            skipped += 1

    # Excluded verses
    excluded = []
    for ref in data.get("excludedVerses", []):
        parsed = parse_verse_ref(ref)
        if parsed:
            book, ch, v = parsed
            excluded.append(f"{book}.{ch}.{v}")

    return {
        "tradition": name,
        "description": TRADITIONS.get(name, name),
        "max_verses": max_verses,
        "verse_mappings": verse_mappings,
        "excluded_verses": excluded,
        "stats": {
            "books": len(max_verses),
            "total_mappings": len(verse_mappings),
            "excluded_count": len(excluded),
            "skipped_apocryphal": skipped,
        },
    }


def build_versification():
    """Build versification mapping data from UBS JSON files."""
    log("Building versification data...")

    # Check source directory
    if not VERSIFICATION_DIR_SRC.exists():
        log("ERROR: Versification source directory not found.")
        log(f"  Expected: {VERSIFICATION_DIR_SRC}")
        log("  Run: bash scripts/fetch-sources.sh")
        sys.exit(1)

    ensure_dir(VERSIFICATION_DIR)

    traditions_processed = {}
    all_stats = {}

    for name, description in TRADITIONS.items():
        src_file = VERSIFICATION_DIR_SRC / f"{name}.json"
        if not src_file.exists():
            log(f"  Warning: {src_file.name} not found, skipping {description}")
            continue

        log(f"  Processing {description} ({name})...")
        raw_data = read_json(src_file)
        processed = process_tradition(name, raw_data)
        traditions_processed[name] = processed
        all_stats[name] = processed["stats"]

        # Write individual tradition file
        write_json(VERSIFICATION_DIR / f"{name}.json", processed)

    # Build a combined lookup: for each tradition, create a flat
    # eng->other and other->eng mapping for quick lookups
    log("  Building lookup tables...")
    for name, tradition in traditions_processed.items():
        eng_to_other = {}
        other_to_eng = {}
        for m in tradition["verse_mappings"]:
            eng_to_other[m["eng"]] = m["other"]
            other_to_eng[m["other"]] = m["eng"]

        lookup = {
            "tradition": name,
            "eng_to_tradition": eng_to_other,
            "tradition_to_eng": other_to_eng,
        }
        write_json(VERSIFICATION_DIR / f"{name}_lookup.json", lookup)

    # Write combined max-verses file (English standard)
    if "eng" in traditions_processed:
        write_json(
            VERSIFICATION_DIR / "max_verses.json",
            traditions_processed["eng"]["max_verses"],
        )

    # Write JSONL with all mappings across traditions
    all_mappings = []
    for name, tradition in traditions_processed.items():
        for m in tradition["verse_mappings"]:
            all_mappings.append({
                "tradition": name,
                "eng": m["eng"],
                "other": m["other"],
            })
    write_jsonl(VERSIFICATION_DIR / "all_mappings.jsonl", all_mappings)

    # Stats
    stats = {
        "traditions": all_stats,
        "total_traditions": len(traditions_processed),
        "total_mappings": sum(s["total_mappings"] for s in all_stats.values()),
    }
    write_json(VERSIFICATION_DIR / "stats.json", stats)

    # Output size
    output_size = sum(
        f.stat().st_size
        for f in VERSIFICATION_DIR.iterdir()
        if f.is_file()
    )

    # Summary
    log("")
    log("=== Versification Build Complete ===")
    for name, s in all_stats.items():
        log(f"  {name}: {s['books']} books, {s['total_mappings']} mappings")
    log(f"Total mappings: {stats['total_mappings']:,}")
    log(f"Output: {VERSIFICATION_DIR}")
    log(f"Output size: {format_file_size(output_size)}")


def main() -> None:
    """Main entry point."""
    build_versification()


if __name__ == "__main__":
    main()
