#!/usr/bin/env python3
"""Build headings index - extract section headings with verse cross-references.

Output: headings.jsonl with bidirectional links to verses
"""

import sys
from pathlib import Path
from typing import Any, TypedDict

from .types import BOOK_CODES, USJ_FILES
from .utils import (
    BASE_DIR,
    USJ_DIR,
    check_sources_exist,
    ensure_dir,
    log,
    log_book_progress,
    read_json,
    write_json,
    write_jsonl,
)


class Heading(TypedDict):
    id: str  # Unique heading ID: "GEN.s1.1", "GEN.s2.3"
    b: str  # Book code
    c: int  # Chapter where heading appears
    before_v: int  # Verse number that follows this heading
    level: str  # Heading level: "s1", "s2", "s3", "r", "d", etc.
    text: str  # Heading text content
    refs: list[str]  # Reference text (for "r" markers), parsed as list


# Heading markers to extract
HEADING_MARKERS = {"s1", "s2", "s3", "s4", "s5", "ms1", "ms2", "r", "d", "sr", "mr"}


def extract_text_from_content(content: list[Any]) -> str:
    """Extract plain text from USJ content array."""
    text = ""
    for item in content:
        if isinstance(item, str):
            text += item
        elif isinstance(item, dict):
            if item.get("type") == "ref":
                # Include reference text
                text += extract_text_from_content(item.get("content", []))
            elif "content" in item:
                text += extract_text_from_content(item["content"])
    return text.strip()


def extract_refs_from_content(content: list[Any]) -> list[str]:
    """Extract reference locations from content (for 'r' markers)."""
    refs = []
    for item in content:
        if isinstance(item, dict):
            if item.get("type") == "ref":
                loc = item.get("loc", "")
                if loc:
                    refs.append(loc)
            elif "content" in item:
                refs.extend(extract_refs_from_content(item["content"]))
    return refs


def parse_headings_from_usj(usj: dict[str, Any], book_code: str) -> list[Heading]:
    """Parse headings from a USJ document."""
    headings: list[Heading] = []
    heading_counts: dict[str, int] = {}  # Track counts per level for unique IDs

    current_chapter = 0
    pending_headings: list[dict[str, Any]] = []  # Headings waiting for next verse

    def flush_pending_headings(verse_num: int) -> None:
        """Assign pending headings to the given verse number."""
        nonlocal pending_headings
        for h in pending_headings:
            level = h["level"]
            heading_counts[level] = heading_counts.get(level, 0) + 1

            heading: Heading = {
                "id": f"{book_code}.{level}.{heading_counts[level]}",
                "b": book_code,
                "c": current_chapter,
                "before_v": verse_num,
                "level": level,
                "text": h["text"],
                "refs": h.get("refs", []),
            }
            headings.append(heading)
        pending_headings = []

    def process_content(content: list[Any]) -> None:
        nonlocal current_chapter, pending_headings

        for item in content:
            if not isinstance(item, dict):
                continue

            item_type = item.get("type")
            marker = item.get("marker", "")

            if item_type == "chapter":
                # Flush any pending headings to chapter start (verse 1)
                if pending_headings and current_chapter > 0:
                    flush_pending_headings(1)
                current_chapter = int(item.get("number", 0))

            elif item_type == "verse":
                verse_num = int(item.get("number", 0))
                if verse_num > 0 and pending_headings:
                    flush_pending_headings(verse_num)

            elif item_type == "para" and marker in HEADING_MARKERS:
                # This is a heading paragraph
                content_list = item.get("content", [])
                text = extract_text_from_content(content_list)
                refs = extract_refs_from_content(content_list) if marker == "r" else []

                if text:  # Only add non-empty headings
                    pending_headings.append(
                        {
                            "level": marker,
                            "text": text,
                            "refs": refs,
                        }
                    )

            elif item_type == "para" and "content" in item:
                # Regular paragraph - process its content for verses
                process_content(item["content"])

            elif "content" in item:
                process_content(item["content"])

    process_content(usj.get("content", []))

    # Flush any remaining headings (shouldn't happen normally)
    if pending_headings and current_chapter > 0:
        flush_pending_headings(1)

    return headings


def build_headings() -> dict[str, list[str]]:
    """Build headings index and return verse-to-heading mapping.

    Returns: dict mapping verse IDs to list of heading IDs
    """
    log("Building headings index...")

    # Check sources exist
    exists, missing = check_sources_exist()
    if not exists:
        log("ERROR: Missing source data:")
        for m in missing:
            log(f"  - {m}")
        sys.exit(1)

    # Ensure output directory exists
    ensure_dir(BASE_DIR)

    all_headings: list[Heading] = []
    total_books = len(BOOK_CODES)

    for book_num, book_code in BOOK_CODES.items():
        log_book_progress(book_num, total_books, book_code)

        # Get USJ file path
        usj_filename = USJ_FILES.get(book_code)
        if not usj_filename:
            continue

        usj_path = USJ_DIR / usj_filename
        if not usj_path.exists():
            continue

        # Parse USJ
        usj = read_json(usj_path)
        headings = parse_headings_from_usj(usj, book_code)
        all_headings.extend(headings)

        log(f"  Found {len(headings)} headings")

    # Build verse-to-heading mapping for cross-referencing
    verse_to_headings: dict[str, list[str]] = {}
    for h in all_headings:
        verse_id = f"{h['b']}.{h['c']}.{h['before_v']}"
        if verse_id not in verse_to_headings:
            verse_to_headings[verse_id] = []
        verse_to_headings[verse_id].append(h["id"])

    # Write headings index
    output_path = BASE_DIR / "headings.jsonl"
    write_jsonl(output_path, all_headings)

    # Write stats
    stats = {
        "total_headings": len(all_headings),
        "by_level": {},
        "verses_with_headings": len(verse_to_headings),
    }
    for h in all_headings:
        level = h["level"]
        stats["by_level"][level] = stats["by_level"].get(level, 0) + 1

    stats_path = BASE_DIR / "headings-stats.json"
    write_json(stats_path, stats)

    log("")
    log("=== Headings Build Complete ===")
    log(f"Total headings: {len(all_headings)}")
    log(f"Verses with headings: {len(verse_to_headings)}")
    for level, count in sorted(stats["by_level"].items()):
        log(f"  {level}: {count}")

    return verse_to_headings


def main() -> None:
    """Main entry point."""
    build_headings()


if __name__ == "__main__":
    main()
