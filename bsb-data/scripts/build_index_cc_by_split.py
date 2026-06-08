#!/usr/bin/env python3
"""Build split CC-BY index output - JSONL files per chapter for easier consumption."""

import sys
from collections import defaultdict
from pathlib import Path

from .types import BOOK_CODES, BuildStats, IndexVerseCCBY
from .utils import (
    INDEX_CC_BY_DIR,
    INDEX_CC_BY_SPLIT_DIR,
    ensure_dir,
    format_file_size,
    log,
    log_book_progress,
    read_jsonl,
    write_json,
    write_jsonl,
)


def build_index_cc_by_split() -> BuildStats:
    """Build split CC-BY index output from the main index file.

    Reads from vector-db/index-cc-by/bible-index.jsonl and splits into
    per-chapter files under base/index-cc-by/{BOOK}/{BOOK}{chapter}.jsonl
    """
    log("Building split CC-BY index output...")

    # Check that the source index exists
    source_path = INDEX_CC_BY_DIR / "bible-index.jsonl"
    if not source_path.exists():
        log("ERROR: CC-BY index not found. Run --index-cc-by first.")
        log(f"  Expected: {source_path}")
        sys.exit(1)

    # Ensure output directory exists
    ensure_dir(INDEX_CC_BY_SPLIT_DIR)

    # Load all verses from the main index
    log("Loading CC-BY index...")
    all_verses: list[IndexVerseCCBY] = read_jsonl(source_path)
    log(f"  Loaded {len(all_verses)} verses")

    # Group verses by book and chapter
    log("Grouping verses by book and chapter...")
    verses_by_book_chapter: dict[str, dict[int, list[IndexVerseCCBY]]] = defaultdict(
        lambda: defaultdict(list)
    )

    for verse in all_verses:
        book = verse["b"]
        chapter = verse["c"]
        verses_by_book_chapter[book][chapter].append(verse)

    # Write output files
    log("Writing chapter files...")
    stats = BuildStats()
    total_books = len(BOOK_CODES)
    files_written = 0

    for book_num, book_code in BOOK_CODES.items():
        log_book_progress(book_num, total_books, book_code)

        if book_code not in verses_by_book_chapter:
            log(f"  WARNING: No verses found for {book_code}")
            continue

        # Create book directory
        book_dir = INDEX_CC_BY_SPLIT_DIR / book_code
        ensure_dir(book_dir)

        chapters = verses_by_book_chapter[book_code]
        stats.books_processed += 1

        for chapter_num in sorted(chapters.keys()):
            chapter_verses = chapters[chapter_num]

            # Remove redundant fields (id, b, c, v, t) since they're in path/line
            compact_verses = []
            for verse in chapter_verses:
                compact_verse = {
                    "s": verse.get("s", []),
                    "x": verse.get("x", []),
                    "tp": verse.get("tp", []),
                    "g": verse.get("g", {}),
                    "m": verse.get("m", []),
                }
                # Only include optional fields if present
                if "h" in verse:
                    compact_verse["h"] = verse["h"]
                if "citations" in verse:
                    compact_verse["citations"] = verse["citations"]
                if "dom" in verse:
                    compact_verse["dom"] = verse["dom"]
                # New UBS enrichment fields
                if "ws" in verse:
                    compact_verse["ws"] = verse["ws"]
                if "img" in verse:
                    compact_verse["img"] = verse["img"]
                if "map" in verse:
                    compact_verse["map"] = verse["map"]
                if "msense" in verse:
                    compact_verse["msense"] = verse["msense"]
                if "par" in verse:
                    compact_verse["par"] = verse["par"]
                compact_verses.append(compact_verse)

            # Write chapter file: {BOOK}/{BOOK}{chapter}.jsonl
            output_path = book_dir / f"{book_code}{chapter_num}.jsonl"
            write_jsonl(output_path, compact_verses)

            stats.total_verses += len(compact_verses)
            files_written += 1

        log(f"  Wrote {len(chapters)} chapters")

    # Write stats
    stats_dict = stats.to_dict()
    stats_dict["files_written"] = files_written
    stats_path = INDEX_CC_BY_SPLIT_DIR / "stats.json"
    write_json(stats_path, stats_dict)

    # Log summary
    log("")
    log("=== Split CC-BY Index Build Complete ===")
    log(f"Books processed: {stats.books_processed}")
    log(f"Total verses: {stats.total_verses}")
    log(f"Chapter files written: {files_written}")

    # Calculate total output size
    total_size = sum(f.stat().st_size for f in INDEX_CC_BY_SPLIT_DIR.rglob("*.jsonl"))
    log(f"Total output size: {format_file_size(total_size)}")

    log("")
    log("NOTE: This output contains:")
    log("      - CC-BY 4.0 licensed content from OSHB (morphology)")
    log("      - CC-BY-SA 4.0 licensed content from UBS (lexicon, sense data, images, maps)")
    log("      See ATTRIBUTION.md for required attribution.")

    return stats


def main() -> None:
    """Main entry point."""
    build_index_cc_by_split()


if __name__ == "__main__":
    main()
