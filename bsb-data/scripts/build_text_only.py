#!/usr/bin/env python3
"""Build text-only output format using plain USJ files via usfmtc.

Output format: {3 letter bookname}_{three digit chapter number}_BSB.txt
with the text of each verse on a new line (no verse numbers).
"""

import sys
from pathlib import Path

import usfmtc

from .types import BOOK_CODES
from .utils import (
    BASE_DIR,
    USJ_PLAIN_DIR,
    ensure_dir,
    log,
    log_book_progress,
)

# Output directory
TEXT_ONLY_DIR = BASE_DIR / "text-only"

# Plain USJ file mapping (short book codes)
PLAIN_USJ_FILES: dict[str, str] = {code: f"{code}.usj" for code in BOOK_CODES.values()}


# USFM/USJ paragraph styles that mark non-body content (section headings,
# cross-reference rows, descriptive titles, intro material). Their text and
# any descendant text must be excluded from verse output.
HEADING_PARA_STYLES = frozenset(
    {
        "s", "s1", "s2", "s3", "s4", "s5", "sd", "sp", "sr",
        "ms", "ms1", "ms2", "ms3",
        "is", "is1", "is2", "is3",
        "r", "ior", "mr",
        "mt", "mt1", "mt2", "mt3", "mt4",
        "d", "dc",
        "imt", "imt1", "imt2", "imt3", "imt4",
        "iot", "io", "io1", "io2", "io3", "io4",
        "iex", "ie", "iqt",
    }
)


def extract_verses_from_usj(usj_path: Path) -> dict[int, dict[int, str]]:
    """Extract verses from a plain USJ file using usfmtc.

    Walks the document tree and accumulates verse text from element `text`
    and `tail` strings, skipping footnote subtrees and section-heading
    paragraphs. Verse text often spans multiple sibling/descendant nodes
    (e.g. footnote tail, in-verse paragraph break, words-of-Jesus chars),
    so a flat root.iter() pass that only reads verse.tail loses content.

    Returns: {chapter_num: {verse_num: text}}
    """
    doc = usfmtc.readFile(str(usj_path))
    root = doc.getroot()

    verses: dict[int, dict[int, str]] = {}
    state = {"chapter": 0, "verse": 0}

    def append(text: str | None) -> None:
        if not text:
            return
        stripped = text.strip()
        if not stripped:
            return
        c, v = state["chapter"], state["verse"]
        if not c or not v:
            return
        chapter_dict = verses.setdefault(c, {})
        existing = chapter_dict.get(v)
        chapter_dict[v] = f"{existing} {stripped}" if existing else stripped

    def walk(elem, in_note: bool, in_heading: bool) -> None:
        tag = elem.tag

        if tag == "chapter":
            try:
                state["chapter"] = int(elem.get("number", 0))
            except ValueError:
                state["chapter"] = 0
            state["verse"] = 0
            verses.setdefault(state["chapter"], {})
            return  # chapter element has no body text we want

        if tag == "verse":
            # Skip explicit verse-end milestones
            if elem.get("eid"):
                return
            num_str = elem.get("number", "")
            if "-" in num_str:
                # Verse ranges (e.g. "1-2"): keep current verse=0 so range
                # text isn't attributed to a single verse.
                state["verse"] = 0
                return
            try:
                state["verse"] = int(num_str)
            except ValueError:
                state["verse"] = 0
            if not in_note and not in_heading:
                append(elem.tail)
            return

        if tag == "note":
            # Footnote: skip subtree text; capture tail (running text resumes).
            # Notes don't contain verse/chapter milestones, so no need to
            # descend for state.
            if not in_note and not in_heading:
                append(elem.tail)
            return

        if tag == "para":
            style = elem.get("style", "")
            heading = in_heading or style in HEADING_PARA_STYLES
            if not in_note and not heading:
                append(elem.text)
            for child in elem:
                walk(child, in_note=in_note, in_heading=heading)
            if not in_note and not heading:
                append(elem.tail)
            return

        # char, ref, w, and other inline elements
        if not in_note and not in_heading:
            append(elem.text)
        for child in elem:
            walk(child, in_note=in_note, in_heading=in_heading)
        if not in_note and not in_heading:
            append(elem.tail)

    walk(root, in_note=False, in_heading=False)
    return verses


def build_text_only() -> None:
    """Build text-only output from plain USJ files."""
    log("Building text-only output...")

    # Check plain USJ sources exist
    if not USJ_PLAIN_DIR.exists():
        log(f"ERROR: Plain USJ files not found at {USJ_PLAIN_DIR}")
        log("Run: bash scripts/fetch-sources.sh")
        sys.exit(1)

    # Ensure output directory exists
    ensure_dir(TEXT_ONLY_DIR)

    total_books = len(BOOK_CODES)
    total_chapters = 0
    total_verses = 0

    for book_num, book_code in BOOK_CODES.items():
        log_book_progress(book_num, total_books, book_code)

        # Get plain USJ file path
        usj_filename = PLAIN_USJ_FILES.get(book_code)
        if not usj_filename:
            log(f"  WARNING: No USJ file mapping for {book_code}")
            continue

        usj_path = USJ_PLAIN_DIR / usj_filename
        if not usj_path.exists():
            log(f"  WARNING: USJ file not found: {usj_path}")
            continue

        # Extract verses using usfmtc
        try:
            chapters = extract_verses_from_usj(usj_path)
        except Exception as e:
            log(f"  ERROR parsing {usj_path}: {e}")
            continue

        # Write each chapter to a file
        book_chapters = 0
        for ch_num in sorted(chapters.keys()):
            ch_verses = chapters[ch_num]

            # Format: {3 letter bookname}_{three digit chapter number}_BSB.txt
            filename = f"{book_code}_{ch_num:03d}_BSB.txt"
            filepath = TEXT_ONLY_DIR / filename

            lines: list[str] = []
            for v_num in sorted(ch_verses.keys()):
                verse_text = ch_verses[v_num]
                lines.append(verse_text)
                total_verses += 1

            filepath.write_text("\n".join(lines) + "\n", encoding="utf-8")
            book_chapters += 1

        total_chapters += book_chapters
        log(f"  Wrote {book_chapters} chapters")

    log("")
    log("=== Text-Only Build Complete ===")
    log(f"Output directory: {TEXT_ONLY_DIR}")
    log(f"Total chapters: {total_chapters}")
    log(f"Total verses: {total_verses}")


def main() -> None:
    """Main entry point."""
    build_text_only()


if __name__ == "__main__":
    main()
