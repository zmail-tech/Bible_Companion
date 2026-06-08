#!/usr/bin/env python3
"""Build Public Domain index output - single JSONL file for vector DB indexing."""

import sys
from pathlib import Path
from typing import Any

from .build_headings import build_headings
from .convert_usj import parse_usj_file
from .enrich_gloss import enrich_with_glosses, load_strongs_lexicon
from .enrich_topics import enrich_with_topics, load_topics
from .enrich_xrefs import enrich_with_xrefs, load_cross_references
from .types import BOOK_CODES, USJ_FILES, BuildStats, IndexVersePD
from .utils import (
    INDEX_PD_DIR,
    USJ_DIR,
    check_sources_exist,
    ensure_dir,
    extract_strongs_from_words,
    format_file_size,
    log,
    log_book_progress,
    verse_id,
    words_to_plain_text,
    write_json,
    write_jsonl,
)


def build_index_pd() -> BuildStats:
    """Build Public Domain index output."""
    log("Building PD index output...")

    # Check sources exist
    exists, missing = check_sources_exist()
    if not exists:
        log("ERROR: Missing source data:")
        for m in missing:
            log(f"  - {m}")
        sys.exit(1)

    # Ensure output directory exists
    ensure_dir(INDEX_PD_DIR)

    # Build headings index first (returns verse-to-heading mapping)
    log("")
    verse_to_headings = build_headings()

    # Load enrichment data
    log("")
    log("Loading enrichment data...")
    xrefs = load_cross_references()
    topics = load_topics()
    lexicon = load_strongs_lexicon()

    log("")
    log("Processing books...")

    stats = BuildStats()
    all_verses: list[IndexVersePD] = []
    total_books = len(BOOK_CODES)

    for book_num, book_code in BOOK_CODES.items():
        log_book_progress(book_num, total_books, book_code)

        # Get USJ file path
        usj_filename = USJ_FILES.get(book_code)
        if not usj_filename:
            log(f"  WARNING: No USJ file mapping for {book_code}")
            continue

        usj_path = USJ_DIR / usj_filename
        if not usj_path.exists():
            log(f"  WARNING: USJ file not found: {usj_path}")
            continue

        # Parse USJ file
        display_verses = parse_usj_file(usj_path)
        stats.books_processed += 1

        # Convert to index format
        for dv in display_verses:
            words = dv["w"]
            vid = verse_id(dv["b"], dv["c"], dv["v"])

            # Extract data
            plain_text = words_to_plain_text(words)
            strongs_list = extract_strongs_from_words(words)

            # Update stats
            stats.total_verses += 1
            stats.total_words += len(words)
            stats.words_with_strongs += sum(1 for _, s in words if s)
            stats.unique_strongs.update(strongs_list)

            # Build index verse
            index_verse: IndexVersePD = {
                "id": vid,
                "b": dv["b"],
                "c": dv["c"],
                "v": dv["v"],
                "t": plain_text,
                "s": strongs_list,
                "x": [],  # Will be filled by enrichment
                "tp": [],  # Will be filled by enrichment
                "g": {},  # Will be filled by enrichment
            }

            # Add citations if present
            if dv.get("citations"):
                index_verse["citations"] = dv["citations"]

            # Add heading references if this verse has headings before it
            if vid in verse_to_headings:
                index_verse["h"] = verse_to_headings[vid]

            all_verses.append(index_verse)

        log(f"  Processed {len(display_verses)} verses")

    # Enrich all verses
    log("")
    log("Enriching verses...")

    log("  Adding cross-references...")
    all_verses = enrich_with_xrefs(all_verses, xrefs)

    log("  Adding topics...")
    all_verses = enrich_with_topics(all_verses, topics)

    log("  Adding glosses...")
    all_verses = enrich_with_glosses(all_verses, lexicon)

    # Count enrichment stats
    for v in all_verses:
        stats.total_cross_references += len(v.get("x", []))
        stats.total_topics += len(v.get("tp", []))

    # Write output
    log("")
    log("Writing output...")
    output_path = INDEX_PD_DIR / "bible-index.jsonl"
    write_jsonl(output_path, all_verses)

    # Write stats
    stats_path = INDEX_PD_DIR / "stats.json"
    write_json(stats_path, stats.to_dict())

    # Log summary
    log("")
    log("=== PD Index Build Complete ===")
    log(f"Books processed: {stats.books_processed}")
    log(f"Total verses: {stats.total_verses}")
    log(f"Total words: {stats.total_words}")
    log(f"Words with Strong's: {stats.words_with_strongs}")
    log(f"Unique Strong's numbers: {len(stats.unique_strongs)}")
    log(f"Total cross-references: {stats.total_cross_references}")
    log(f"Total topic assignments: {stats.total_topics}")

    output_size = output_path.stat().st_size
    log(f"Output file: {output_path}")
    log(f"Output size: {format_file_size(output_size)}")

    return stats


def main() -> None:
    """Main entry point."""
    build_index_pd()


if __name__ == "__main__":
    main()
