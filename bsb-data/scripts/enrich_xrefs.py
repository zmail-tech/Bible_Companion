"""Add TSK cross-references to verse data."""

from typing import Any

from .types import BOOK_CODES
from .utils import BIBLE_DB_DIR, log, read_json, verse_id

# Map book names to codes
BOOK_NAME_TO_CODE: dict[str, str] = {
    "Genesis": "GEN",
    "Exodus": "EXO",
    "Leviticus": "LEV",
    "Numbers": "NUM",
    "Deuteronomy": "DEU",
    "Joshua": "JOS",
    "Judges": "JDG",
    "Ruth": "RUT",
    "1 Samuel": "1SA",
    "2 Samuel": "2SA",
    "1 Kings": "1KI",
    "2 Kings": "2KI",
    "1 Chronicles": "1CH",
    "2 Chronicles": "2CH",
    "Ezra": "EZR",
    "Nehemiah": "NEH",
    "Esther": "EST",
    "Job": "JOB",
    "Psalms": "PSA",
    "Proverbs": "PRO",
    "Ecclesiastes": "ECC",
    "Song of Solomon": "SNG",
    "Isaiah": "ISA",
    "Jeremiah": "JER",
    "Lamentations": "LAM",
    "Ezekiel": "EZK",
    "Daniel": "DAN",
    "Hosea": "HOS",
    "Joel": "JOL",
    "Amos": "AMO",
    "Obadiah": "OBA",
    "Jonah": "JON",
    "Micah": "MIC",
    "Nahum": "NAM",
    "Habakkuk": "HAB",
    "Zephaniah": "ZEP",
    "Haggai": "HAG",
    "Zechariah": "ZEC",
    "Malachi": "MAL",
    "Matthew": "MAT",
    "Mark": "MRK",
    "Luke": "LUK",
    "John": "JHN",
    "Acts": "ACT",
    "Romans": "ROM",
    "1 Corinthians": "1CO",
    "2 Corinthians": "2CO",
    "Galatians": "GAL",
    "Ephesians": "EPH",
    "Philippians": "PHP",
    "Colossians": "COL",
    "1 Thessalonians": "1TH",
    "2 Thessalonians": "2TH",
    "1 Timothy": "1TI",
    "2 Timothy": "2TI",
    "Titus": "TIT",
    "Philemon": "PHM",
    "Hebrews": "HEB",
    "James": "JAS",
    "1 Peter": "1PE",
    "2 Peter": "2PE",
    "1 John": "1JN",
    "2 John": "2JN",
    "3 John": "3JN",
    "Jude": "JUD",
    "Revelation": "REV",
}


def book_name_to_code(name: str) -> str | None:
    """Convert book name to code."""
    return BOOK_NAME_TO_CODE.get(name)


def load_cross_references() -> dict[str, list[str]]:
    """
    Load cross-references from scrollmapper bible_databases.
    Returns a dict mapping verse IDs to lists of referenced verse IDs.
    """
    xref_dir = BIBLE_DB_DIR / "sources" / "extras"

    if not xref_dir.exists():
        log(f"WARNING: Cross-references not found at {xref_dir}")
        return {}

    # Load all cross_references_*.json files
    xref_files = sorted(xref_dir.glob("cross_references_*.json"))
    if not xref_files:
        log(f"WARNING: No cross-reference files found in {xref_dir}")
        return {}

    log(f"Loading cross-references from {len(xref_files)} files...")

    xrefs: dict[str, list[str]] = {}
    total_entries = 0

    for xref_file in xref_files:
        file_data = read_json(xref_file)

        # Handle the nested format: {"cross_references": [...]}
        if isinstance(file_data, dict) and "cross_references" in file_data:
            entries = file_data["cross_references"]
        elif isinstance(file_data, list):
            entries = file_data
        else:
            continue

        for entry in entries:
            try:
                # Parse from_verse
                from_verse = entry.get("from_verse", {})
                from_book_name = from_verse.get("book")
                from_chapter = from_verse.get("chapter")
                from_verse_num = from_verse.get("verse")

                from_book_code = book_name_to_code(from_book_name)
                if not from_book_code or not from_chapter or not from_verse_num:
                    continue

                from_id = verse_id(from_book_code, from_chapter, from_verse_num)

                # Parse to_verse (can be a list)
                to_verses = entry.get("to_verse", [])
                if not isinstance(to_verses, list):
                    to_verses = [to_verses]

                for to_verse in to_verses:
                    to_book_name = to_verse.get("book")
                    to_chapter = to_verse.get("chapter")
                    to_verse_start = to_verse.get("verse_start") or to_verse.get("verse")

                    to_book_code = book_name_to_code(to_book_name)
                    if not to_book_code or not to_chapter or not to_verse_start:
                        continue

                    to_id = verse_id(to_book_code, to_chapter, to_verse_start)

                    if from_id not in xrefs:
                        xrefs[from_id] = []

                    if to_id not in xrefs[from_id]:
                        xrefs[from_id].append(to_id)
                        total_entries += 1

            except (ValueError, KeyError, TypeError):
                continue

    log(f"Loaded {len(xrefs)} verses with cross-references")
    log(f"Total cross-references: {total_entries}")

    return xrefs


def enrich_with_xrefs(
    verses: list[dict[str, Any]], xrefs: dict[str, list[str]]
) -> list[dict[str, Any]]:
    """Add cross-references to verse data."""
    enriched = []

    for verse in verses:
        vid = verse_id(verse["b"], verse["c"], verse["v"])
        verse_xrefs = xrefs.get(vid, [])

        enriched_verse = {**verse, "x": verse_xrefs}
        enriched.append(enriched_verse)

    return enriched
