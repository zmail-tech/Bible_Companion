#!/usr/bin/env python3
"""Build display output - JSON files per chapter for web rendering.

ENG text comes from USJ source (includes punctuation).
HEB/GRK text comes from TSV source (word-level alignment).
"""

import csv
import re
import sys
from collections import defaultdict
from pathlib import Path

from .convert_usj import parse_usj_file
from .types import BOOK_CODES, BuildStats
from .utils import (
    BSB_TABLES_FILE,
    DISPLAY_DIR,
    USJ_DIR,
    ensure_dir,
    format_file_size,
    log,
    write_json,
)

# Unicode directional control characters to remove
DIRECTIONAL_CHARS = re.compile(
    r"[\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069]"
)


def clean_text(text: str) -> str:
    """Remove Unicode directional control characters from text."""
    return DIRECTIONAL_CHARS.sub("", text)


# Mapping from TSV VerseId book names to our 3-letter codes
BOOK_NAME_TO_CODE = {
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
    "Psalm": "PSA",
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

# USJ filename mapping (book number -> filename prefix)
# Note: USJ uses different numbering - NT starts at 41, not 40
USJ_FILE_PREFIX = {
    1: "01GEN",
    2: "02EXO",
    3: "03LEV",
    4: "04NUM",
    5: "05DEU",
    6: "06JOS",
    7: "07JDG",
    8: "08RUT",
    9: "091SA",
    10: "102SA",
    11: "111KI",
    12: "122KI",
    13: "131CH",
    14: "142CH",
    15: "15EZR",
    16: "16NEH",
    17: "17EST",
    18: "18JOB",
    19: "19PSA",
    20: "20PRO",
    21: "21ECC",
    22: "22SNG",
    23: "23ISA",
    24: "24JER",
    25: "25LAM",
    26: "26EZK",
    27: "27DAN",
    28: "28HOS",
    29: "29JOL",
    30: "30AMO",
    31: "31OBA",
    32: "32JON",
    33: "33MIC",
    34: "34NAM",
    35: "35HAB",
    36: "36ZEP",
    37: "37HAG",
    38: "38ZEC",
    39: "39MAL",
    40: "41MAT",  # USJ numbering: 41
    41: "42MRK",  # USJ numbering: 42
    42: "43LUK",  # USJ numbering: 43
    43: "44JHN",  # USJ numbering: 44
    44: "45ACT",  # USJ numbering: 45
    45: "46ROM",  # USJ numbering: 46
    46: "471CO",  # USJ numbering: 47
    47: "482CO",  # USJ numbering: 48
    48: "49GAL",  # USJ numbering: 49
    49: "50EPH",  # USJ numbering: 50
    50: "51PHP",  # USJ numbering: 51
    51: "52COL",  # USJ numbering: 52
    52: "531TH",  # USJ numbering: 53
    53: "542TH",  # USJ numbering: 54
    54: "551TI",  # USJ numbering: 55
    55: "562TI",  # USJ numbering: 56
    56: "57TIT",  # USJ numbering: 57
    57: "58PHM",  # USJ numbering: 58
    58: "59HEB",  # USJ numbering: 59
    59: "60JAS",  # USJ numbering: 60
    60: "611PE",  # USJ numbering: 61
    61: "622PE",  # USJ numbering: 62
    62: "631JN",  # USJ numbering: 63
    63: "642JN",  # USJ numbering: 64
    64: "653JN",  # USJ numbering: 65
    65: "66JUD",  # USJ numbering: 66
    66: "67REV",  # USJ numbering: 67
}


def parse_verse_id(verse_id: str) -> tuple[str, int, int] | None:
    """Parse VerseId like 'Genesis 1:1' to (book_code, chapter, verse)."""
    if not verse_id or ":" not in verse_id:
        return None

    parts = verse_id.rsplit(":", 1)
    if len(parts) != 2:
        return None

    book_chapter, verse_str = parts
    last_space = book_chapter.rfind(" ")
    if last_space == -1:
        return None

    book_name = book_chapter[:last_space]
    chapter_str = book_chapter[last_space + 1 :]

    book_code = BOOK_NAME_TO_CODE.get(book_name)
    if not book_code:
        return None

    try:
        chapter = int(chapter_str)
        verse = int(verse_str)
        return (book_code, chapter, verse)
    except ValueError:
        return None


def load_usj_data() -> dict:
    """Load English text from USJ files.

    Returns a nested dict: {book: {chapter: {verse: [[text, strongs], ...]}}}
    """
    log("Loading USJ data for English text...")

    if not USJ_DIR.exists():
        log(f"ERROR: USJ directory not found: {USJ_DIR}")
        log("  Run: bash scripts/fetch-sources.sh")
        sys.exit(1)

    # Structure: {book: {chapter: {verse: [[text, strongs], ...]}}}
    data: dict = defaultdict(lambda: defaultdict(dict))

    for book_num, book_code in BOOK_CODES.items():
        prefix = USJ_FILE_PREFIX.get(book_num)
        if not prefix:
            continue

        usj_file = USJ_DIR / f"{prefix}BSB_full_strongs.usj"
        if not usj_file.exists():
            log(f"  WARNING: USJ file not found: {usj_file}")
            continue

        verses = parse_usj_file(usj_file)

        for verse in verses:
            book = verse["b"]
            chapter = verse["c"]
            verse_num = verse["v"]
            words = verse["w"]

            # Convert word tuples to list format [[text, strongs], ...]
            word_list = [[text, strongs] for text, strongs in words]
            data[book][chapter][verse_num] = word_list

    log(f"  Loaded USJ data for {len(data)} books")
    return data


def load_tsv_original_language_data() -> dict:
    """Load Hebrew/Greek text from TSV file.

    Returns a nested dict: {book: {chapter: {verse: {"orig": [[text, strongs], ...], "lang": "heb"|"grk"}}}}
    """
    log("Loading TSV data for Hebrew/Greek text...")

    if not BSB_TABLES_FILE.exists():
        log(f"ERROR: BSB tables file not found: {BSB_TABLES_FILE}")
        log("  Run: bash scripts/fetch-sources.sh")
        sys.exit(1)

    # Track current verse context for rows without VerseId
    current_book = None
    current_chapter = None
    current_verse = None

    # Structure: {book: {chapter: {verse: {"orig": {sort: [text, strongs]}, "lang": "heb"|"grk"}}}}
    data: dict = defaultdict(
        lambda: defaultdict(lambda: defaultdict(lambda: {"orig": {}, "lang": "heb"}))
    )

    with open(BSB_TABLES_FILE, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        next(reader)  # Skip header

        for row in reader:
            if len(row) < 19:
                continue

            heb_sort = row[0]
            grk_sort = row[1]
            language = row[4]
            orig_text = row[5]  # Hebrew or Greek text
            strongs_heb = row[10] if len(row) > 10 else ""
            strongs_grk = row[11] if len(row) > 11 else ""
            verse_id_col = row[12] if len(row) > 12 else ""

            # Parse verse reference if present
            if verse_id_col and ":" in verse_id_col:
                parsed = parse_verse_id(verse_id_col)
                if parsed:
                    current_book, current_chapter, current_verse = parsed

            # Skip if we don't have a current verse context
            if not current_book or not current_chapter or not current_verse:
                continue

            # Skip non-Hebrew/Greek rows
            if language not in ("Hebrew", "Greek"):
                continue

            # Skip empty original text
            if not orig_text.strip():
                continue

            # Determine Strong's number and sort order
            if language == "Hebrew":
                strongs_raw = strongs_heb.strip()
                strongs = f"H{strongs_raw}" if strongs_raw and strongs_raw != "-" else None
                orig_sort = int(heb_sort) if heb_sort.isdigit() else 999999
            else:  # Greek
                strongs_raw = strongs_grk.strip()
                strongs = f"G{strongs_raw}" if strongs_raw else None
                orig_sort = int(grk_sort) if grk_sort.isdigit() else 999999

            # Clean up strongs
            if strongs:
                strongs = strongs.split()[0].rstrip("-").rstrip()
                if strongs in ("H", "G", "H-", "G-"):
                    strongs = None

            verse_data = data[current_book][current_chapter][current_verse]
            verse_data["lang"] = "heb" if language == "Hebrew" else "grk"

            # Store original text (Hebrew/Greek) with sort order
            cleaned_orig = clean_text(orig_text.strip())
            verse_data["orig"][orig_sort] = [cleaned_orig, strongs]

    log(f"  Loaded TSV data for {len(data)} books")
    return data


def build_display() -> BuildStats:
    """Build display output files."""
    log("Building display output...")

    # Load ENG data from USJ
    usj_data = load_usj_data()

    # Load HEB/GRK data from TSV
    tsv_data = load_tsv_original_language_data()

    if not usj_data:
        log("ERROR: No data loaded from USJ")
        sys.exit(1)

    # Ensure output directory exists
    ensure_dir(DISPLAY_DIR)

    stats = BuildStats()
    total_books = len(BOOK_CODES)
    files_written = 0

    for book_num, book_code in BOOK_CODES.items():
        log(f"Processing {book_code} ({book_num}/{total_books})")

        if book_code not in usj_data:
            log(f"  WARNING: No USJ data for {book_code}")
            continue

        usj_book_data = usj_data[book_code]
        tsv_book_data = tsv_data.get(book_code, {})
        stats.books_processed += 1

        # Create book directory
        book_dir = DISPLAY_DIR / book_code
        ensure_dir(book_dir)

        # Get all chapters from USJ (primary source for chapters)
        chapters = sorted(usj_book_data.keys())

        for chapter in chapters:
            usj_chapter_data = usj_book_data[chapter]
            tsv_chapter_data = tsv_book_data.get(chapter, {})

            # Build chapter output structure
            eng_output = {}
            orig_output = {}

            # Determine language from TSV data (heb or grk)
            lang_key = "heb"  # Default for OT
            if book_num >= 40:  # NT books
                lang_key = "grk"

            # Check TSV data for actual language
            for verse in tsv_chapter_data:
                if tsv_chapter_data[verse].get("lang"):
                    lang_key = tsv_chapter_data[verse]["lang"]
                    break

            for verse in sorted(usj_chapter_data.keys()):
                eng_words = usj_chapter_data[verse]

                if eng_words:
                    eng_output[str(verse)] = eng_words
                    stats.total_verses += 1
                    stats.total_words += len(eng_words)
                    for text, strongs in eng_words:
                        if strongs:
                            stats.words_with_strongs += 1
                            stats.unique_strongs.add(strongs)

                # Get original language words from TSV
                tsv_verse_data = tsv_chapter_data.get(verse, {})
                if tsv_verse_data and "orig" in tsv_verse_data:
                    orig_words = []
                    for sort_key in sorted(tsv_verse_data["orig"].keys()):
                        orig_words.append(tsv_verse_data["orig"][sort_key])
                    if orig_words:
                        orig_output[str(verse)] = orig_words

            if eng_output:
                # Build final chapter JSON
                chapter_output = {
                    "eng": eng_output,
                    lang_key: orig_output,
                }

                # Write chapter file as compact JSON
                output_path = book_dir / f"{book_code}{chapter}.json"
                write_json(output_path, chapter_output, compact=True)
                files_written += 1

        log(f"  Wrote {len(chapters)} chapters")

    # Write stats
    stats_dict = stats.to_dict()
    stats_dict["files_written"] = files_written
    stats_path = DISPLAY_DIR / "stats.json"
    write_json(stats_path, stats_dict)

    # Log summary
    log("")
    log("=== Display Build Complete ===")
    log(f"Books processed: {stats.books_processed}")
    log(f"Total verses: {stats.total_verses}")
    log(f"Total words: {stats.total_words}")
    log(f"Words with Strong's: {stats.words_with_strongs}")
    log(f"Unique Strong's numbers: {len(stats.unique_strongs)}")
    log(f"Chapter files written: {files_written}")

    # Calculate total output size
    total_size = sum(f.stat().st_size for f in DISPLAY_DIR.rglob("*.json"))
    log(f"Total output size: {format_file_size(total_size)}")

    return stats


def main() -> None:
    """Main entry point."""
    build_display()


if __name__ == "__main__":
    main()
