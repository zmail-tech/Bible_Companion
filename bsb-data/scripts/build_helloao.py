#!/usr/bin/env python3
"""Build helloao-compatible output format.

Output structure compatible with https://bible.helloao.org/docs/
"""

import sys
from pathlib import Path
from typing import Any

from .convert_usj import parse_usj_file
from .types import BOOK_CODES, USJ_FILES
from .utils import (
    BASE_DIR,
    USJ_DIR,
    check_sources_exist,
    ensure_dir,
    log,
    log_book_progress,
    write_json,
)

# Output directory
HELLOAO_DIR = BASE_DIR / "helloao"

# Book names for helloao format
BOOK_NAMES: dict[str, str] = {
    "GEN": "Genesis",
    "EXO": "Exodus",
    "LEV": "Leviticus",
    "NUM": "Numbers",
    "DEU": "Deuteronomy",
    "JOS": "Joshua",
    "JDG": "Judges",
    "RUT": "Ruth",
    "1SA": "1 Samuel",
    "2SA": "2 Samuel",
    "1KI": "1 Kings",
    "2KI": "2 Kings",
    "1CH": "1 Chronicles",
    "2CH": "2 Chronicles",
    "EZR": "Ezra",
    "NEH": "Nehemiah",
    "EST": "Esther",
    "JOB": "Job",
    "PSA": "Psalms",
    "PRO": "Proverbs",
    "ECC": "Ecclesiastes",
    "SNG": "Song of Solomon",
    "ISA": "Isaiah",
    "JER": "Jeremiah",
    "LAM": "Lamentations",
    "EZK": "Ezekiel",
    "DAN": "Daniel",
    "HOS": "Hosea",
    "JOL": "Joel",
    "AMO": "Amos",
    "OBA": "Obadiah",
    "JON": "Jonah",
    "MIC": "Micah",
    "NAM": "Nahum",
    "HAB": "Habakkuk",
    "ZEP": "Zephaniah",
    "HAG": "Haggai",
    "ZEC": "Zechariah",
    "MAL": "Malachi",
    "MAT": "Matthew",
    "MRK": "Mark",
    "LUK": "Luke",
    "JHN": "John",
    "ACT": "Acts",
    "ROM": "Romans",
    "1CO": "1 Corinthians",
    "2CO": "2 Corinthians",
    "GAL": "Galatians",
    "EPH": "Ephesians",
    "PHP": "Philippians",
    "COL": "Colossians",
    "1TH": "1 Thessalonians",
    "2TH": "2 Thessalonians",
    "1TI": "1 Timothy",
    "2TI": "2 Timothy",
    "TIT": "Titus",
    "PHM": "Philemon",
    "HEB": "Hebrews",
    "JAS": "James",
    "1PE": "1 Peter",
    "2PE": "2 Peter",
    "1JN": "1 John",
    "2JN": "2 John",
    "3JN": "3 John",
    "JUD": "Jude",
    "REV": "Revelation",
}


def words_to_helloao_content(words: list[tuple[str, str | None]]) -> list[Any]:
    """Convert word pairs to helloao content format."""
    content: list[Any] = []

    for text, strongs in words:
        if not text:
            continue

        if strongs:
            # Word with Strong's number - use formatted text object
            content.append({"text": text, "strong": strongs})
        else:
            # Plain text (punctuation, etc.)
            content.append(text)

    return content


def build_helloao() -> None:
    """Build helloao-compatible output."""
    log("Building helloao output...")

    # Check sources exist
    exists, missing = check_sources_exist()
    if not exists:
        log("ERROR: Missing source data:")
        for m in missing:
            log(f"  - {m}")
        sys.exit(1)

    # Ensure output directory exists
    ensure_dir(HELLOAO_DIR)

    # Build books list
    books_list: list[dict[str, Any]] = []
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
        verses = parse_usj_file(usj_path)

        # Group verses by chapter
        chapters: dict[int, list[dict[str, Any]]] = {}
        for verse in verses:
            ch = verse["c"]
            if ch not in chapters:
                chapters[ch] = []
            chapters[ch].append(verse)

        # Create book directory
        book_dir = HELLOAO_DIR / book_code
        ensure_dir(book_dir)

        # Write each chapter
        for ch_num, ch_verses in sorted(chapters.items()):
            chapter_content: list[dict[str, Any]] = []

            for v in ch_verses:
                verse_content = words_to_helloao_content(v["w"])
                chapter_content.append(
                    {"type": "verse", "number": v["v"], "content": verse_content}
                )

            chapter_data = {
                "translation": {
                    "id": "BSB",
                    "name": "Berean Standard Bible",
                    "language": "en",
                    "license": "CC0",
                    "website": "https://berean.bible",
                },
                "book": {
                    "id": book_code,
                    "name": BOOK_NAMES.get(book_code, book_code),
                    "number": book_num,
                },
                "chapter": {"number": ch_num, "content": chapter_content, "footnotes": []},
            }

            chapter_path = book_dir / f"{ch_num}.json"
            write_json(chapter_path, chapter_data)

        # Add to books list
        books_list.append(
            {
                "id": book_code,
                "name": BOOK_NAMES.get(book_code, book_code),
                "number": book_num,
                "chapters": len(chapters),
            }
        )

        log(f"  Wrote {len(chapters)} chapters")

    # Write books.json
    write_json(HELLOAO_DIR / "books.json", books_list)

    log("")
    log("=== HelloAO Build Complete ===")
    log(f"Output directory: {HELLOAO_DIR}")
    log(f"Books: {len(books_list)}")


def main() -> None:
    """Main entry point."""
    build_helloao()


if __name__ == "__main__":
    main()
