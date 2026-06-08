#!/usr/bin/env python3
"""Build English concordance index - maps English words to verse references."""

import csv
import re
import sys
from collections import defaultdict

from .types import BOOK_CODES, BuildStats
from .utils import (
    BSB_CONCORDANCE_FILE,
    ENGLISH_CONCORDANCE_DIR,
    ensure_dir,
    format_file_size,
    log,
    write_json,
    write_jsonl,
)

# Mapping from CSV book abbreviations to pipeline book codes
CSV_BOOK_CODE_MAP = {
    # Old Testament
    "Gen": "GEN",
    "Exo": "EXO",
    "Lev": "LEV",
    "Num": "NUM",
    "Deu": "DEU",
    "Jos": "JOS",
    "Jdg": "JDG",
    "Rut": "RUT",
    "1Sa": "1SA",
    "2Sa": "2SA",
    "1Ki": "1KI",
    "2Ki": "2KI",
    "1Ch": "1CH",
    "2Ch": "2CH",
    "Ezr": "EZR",
    "Neh": "NEH",
    "Est": "EST",
    "Job": "JOB",
    "Psa": "PSA",
    "Pro": "PRO",
    "Ecc": "ECC",
    "Sng": "SNG",
    "Isa": "ISA",
    "Jer": "JER",
    "Lam": "LAM",
    "Eze": "EZK",
    "Dan": "DAN",
    "Hos": "HOS",
    "Joe": "JOL",
    "Amo": "AMO",
    "Oba": "OBA",
    "Jon": "JON",
    "Mic": "MIC",
    "Nam": "NAM",
    "Hab": "HAB",
    "Zep": "ZEP",
    "Hag": "HAG",
    "Zec": "ZEC",
    "Mal": "MAL",
    # New Testament
    "Mat": "MAT",
    "Mrk": "MRK",
    "Luk": "LUK",
    "Joh": "JHN",
    "Act": "ACT",
    "Rom": "ROM",
    "1Co": "1CO",
    "2Co": "2CO",
    "Gal": "GAL",
    "Eph": "EPH",
    "Php": "PHP",
    "Col": "COL",
    "1Th": "1TH",
    "2Th": "2TH",
    "1Ti": "1TI",
    "2Ti": "2TI",
    "Tit": "TIT",
    "Phm": "PHM",
    "Heb": "HEB",
    "Jas": "JAS",
    "1Pe": "1PE",
    "2Pe": "2PE",
    "1Joh": "1JN",
    "2Joh": "2JN",
    "3Joh": "3JN",
    "Jud": "JUD",
    "Rev": "REV",
}


def normalize_book_code(book: str) -> str:
    """Normalize book code from CSV format to pipeline format.

    Examples:
        "Gen" -> "GEN"
        "1Ki" -> "1KI"
        "Psa" -> "PSA"
    """
    if not book:
        return ""

    # Handle books with numbers (1Ki, 2Ch, etc.)
    match = re.match(r"^(\d?)([A-Za-z]+)$", book)
    if match:
        num, name = match.groups()
        return num + name.upper()

    return book.upper()


def parse_verse_reference(verse_ref: str) -> tuple[str, int, int] | None:
    """Parse verse reference from CSV format to components.

    Examples:
        "Gen 1:1" -> ("GEN", 1, 1)
        "1Ki 2:3" -> ("1KI", 2, 3)
        "Psa 23:1" -> ("PSA", 23, 1)
        "1 Joh 1:1" -> ("1JN", 1, 1)

    Returns None if parsing fails.
    """
    if not verse_ref:
        return None

    # Match pattern: "Book Chapter:Verse" or "Number Book Chapter:Verse"
    # This handles cases like "1 Joh 1:1", "2 Cor 3:4", etc.
    match = re.match(r"^(\d?\s?[A-Za-z]+)\s+(\d+):(\d+)$", verse_ref.strip())
    if not match:
        return None

    book, chapter, verse = match.groups()
    # Remove any spaces from book name
    book_clean = book.replace(" ", "")

    # Try to map from CSV format to pipeline format
    if book_clean in CSV_BOOK_CODE_MAP:
        book_code = CSV_BOOK_CODE_MAP[book_clean]
    else:
        # Fallback to normalization
        book_code = normalize_book_code(book_clean)

    # Validate book code
    if book_code not in BOOK_CODES.values():
        return None

    try:
        return book_code, int(chapter), int(verse)
    except ValueError:
        return None


def format_verse_id(book: str, chapter: int, verse: int) -> str:
    """Format verse ID in pipeline format."""
    return f"{book}.{chapter}.{verse}"


def normalize_entry(entry: str) -> str:
    """Normalize entry text for consistent indexing.

    - Strip whitespace
    - Remove leading/trailing punctuation
    - Preserve case (for proper nouns)
    """
    if not entry:
        return ""

    # Strip whitespace
    entry = entry.strip()

    # Remove trailing occurrence info if present (e.g., "Aaron (321 Occurrences)")
    entry = re.sub(r"\s*\(\d+\s+Occurrences?\)$", "", entry)

    return entry


def is_header_row(row: dict) -> bool:
    """Check if row is a header/separator row (e.g., "Aaron (321 Occurrences)")."""
    # Header rows have Occ=0 and no verse reference
    return row.get("Occ") == "0" and not row.get("Verse")


def extract_entry_from_header(row: dict) -> str | None:
    """Extract the entry word from a header row.

    Header rows have Entry like "Aaron (321 Occurrences)" or "10 (2 Occurrences)".
    Extract just the word/phrase part.
    """
    entry = row.get("Entry", "")
    if not entry:
        return None

    # Normalize and extract
    return normalize_entry(entry)


def build_english_concordance() -> dict[str, list[str]]:
    """Build English concordance index mapping words to verse IDs.

    Reads from sources/bsb_concordance/bsb_concordance.csv and creates a mapping
    of each English word to all verses where it appears.

    Output format (JSON):
    {
        "Aaron": ["EXO.4.14", "EXO.4.27", ...],
        "God": ["GEN.1.1", "GEN.1.2", ...],
        "love": ["GEN.22.2", "GEN.24.67", ...],
        ...
    }
    """
    log("Building English concordance index...")

    # Check that the source concordance exists
    if not BSB_CONCORDANCE_FILE.exists():
        log("ERROR: BSB concordance CSV not found.")
        log(f"  Expected: {BSB_CONCORDANCE_FILE}")
        sys.exit(1)

    # Ensure output directory exists
    ensure_dir(ENGLISH_CONCORDANCE_DIR)

    # Build concordance: English word -> list of verse IDs
    log("Parsing CSV and building concordance mapping...")
    concordance: dict[str, list[str]] = defaultdict(list)

    total_rows = 0
    processed_rows = 0
    skipped_rows = 0
    invalid_refs = 0
    current_entry = None

    with open(BSB_CONCORDANCE_FILE, encoding="utf-8-sig") as f:
        # Skip the first line (copyright notice)
        next(f)

        reader = csv.DictReader(f)

        for row in reader:
            total_rows += 1

            # Check if this is a header row
            if is_header_row(row):
                # Extract the entry from the header
                current_entry = extract_entry_from_header(row)
                skipped_rows += 1
                continue

            # Data rows use the current entry from the most recent header
            if not current_entry:
                skipped_rows += 1
                continue

            # Parse verse reference
            verse_ref = row.get("Verse", "")
            parsed = parse_verse_reference(verse_ref)

            if not parsed:
                invalid_refs += 1
                continue

            book, chapter, verse = parsed
            verse_id = format_verse_id(book, chapter, verse)

            # Add to concordance (avoid duplicates)
            if verse_id not in concordance[current_entry]:
                concordance[current_entry].append(verse_id)

            processed_rows += 1

    log(f"  Total rows: {total_rows:,}")
    log(f"  Processed: {processed_rows:,}")
    log(f"  Skipped: {skipped_rows:,}")
    log(f"  Invalid refs: {invalid_refs:,}")
    log(f"  Unique entries: {len(concordance):,}")

    # Sort entries alphabetically (case-insensitive)
    log("Sorting entries...")
    sorted_entries = sorted(concordance.keys(), key=lambda x: x.lower())
    sorted_concordance = {entry: concordance[entry] for entry in sorted_entries}

    # Write output as single JSON file
    log("Writing English concordance...")
    output_path = ENGLISH_CONCORDANCE_DIR / "words-to-verses.json"
    write_json(output_path, sorted_concordance)

    # Also write a JSONL version for streaming access
    jsonl_path = ENGLISH_CONCORDANCE_DIR / "words-to-verses.jsonl"
    jsonl_data = [{"word": word, "verses": verses} for word, verses in sorted_concordance.items()]
    write_jsonl(jsonl_path, jsonl_data)

    # Write stats
    total_entries = len(sorted_concordance)
    total_refs = sum(len(verses) for verses in sorted_concordance.values())

    # Categorize entries
    proper_nouns = sum(1 for entry in sorted_concordance if entry and entry[0].isupper())
    numbers = sum(1 for entry in sorted_concordance if entry and entry[0].isdigit())
    common_words = total_entries - proper_nouns - numbers

    # Find most and least frequent words
    sorted_by_freq = sorted(sorted_concordance.items(), key=lambda x: len(x[1]), reverse=True)

    most_frequent = [
        {"word": word, "occurrences": len(verses)} for word, verses in sorted_by_freq[:20]
    ]

    stats = {
        "total_entries": total_entries,
        "proper_nouns": proper_nouns,
        "numbers": numbers,
        "common_words": common_words,
        "total_verse_references": total_refs,
        "avg_verses_per_entry": round(total_refs / total_entries, 2) if total_entries else 0,
        "most_frequent_words": most_frequent,
    }
    stats_path = ENGLISH_CONCORDANCE_DIR / "stats.json"
    write_json(stats_path, stats)

    # Calculate output size
    output_size = output_path.stat().st_size + jsonl_path.stat().st_size

    # Log summary
    log("")
    log("=== English Concordance Build Complete ===")
    log(f"Total entries: {total_entries:,}")
    log(f"  Proper nouns: {proper_nouns:,}")
    log(f"  Numbers: {numbers:,}")
    log(f"  Common words: {common_words:,}")
    log(f"Total verse references: {total_refs:,}")
    log(f"Average verses per entry: {stats['avg_verses_per_entry']}")
    log("")
    log(f"Most frequent words:")
    for item in most_frequent[:10]:
        log(f"  {item['word']}: {item['occurrences']:,} occurrences")
    log("")
    log(f"Output: {ENGLISH_CONCORDANCE_DIR}")
    log(f"Output size: {format_file_size(output_size)}")

    return sorted_concordance


def main() -> None:
    """Main entry point."""
    build_english_concordance()


if __name__ == "__main__":
    main()
