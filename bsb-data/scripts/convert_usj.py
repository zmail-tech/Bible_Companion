"""USJ Parser - Convert BSB-USJ format to DisplayVerse format."""

import re
from pathlib import Path
from typing import Any

from .types import DisplayVerse
from .utils import normalize_strongs, read_json


def parse_usj_file(file_path: Path) -> list[DisplayVerse]:
    """Parse a USJ file and extract verses with Strong's numbers."""
    usj = read_json(file_path)
    return parse_usj_document(usj)


def parse_usj_document(usj: dict[str, Any]) -> list[DisplayVerse]:
    """Parse a USJ document and extract all verses."""
    verses: list[DisplayVerse] = []
    current_book = ""
    current_chapter = 0
    current_verse = 0
    current_words: list[tuple[str, str | None]] = []
    current_citations: list[str] = []

    def add_text(text: str) -> None:
        """Add text to current verse."""
        nonlocal current_words
        if current_verse > 0:
            # Check if we can merge with previous word that has no strongs
            if current_words and current_words[-1][1] is None:
                current_words[-1] = (current_words[-1][0] + text, None)
            else:
                current_words.append((text, None))

    def extract_text(content: list[Any]) -> str:
        """Extract plain text from content array."""
        text = ""
        for item in content:
            if isinstance(item, str):
                text += item
            elif isinstance(item, dict) and "content" in item:
                text += extract_text(item["content"])
        return text

    def extract_citations_from_note(note: dict[str, Any]) -> list[str]:
        """Extract citation references from a footnote."""
        citations = []
        content = note.get("content", [])
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "ref":
                    # Extract the location (e.g., "2CO 4:6")
                    loc = item.get("loc", "")
                    if loc:
                        citations.append(loc)
                elif "content" in item:
                    # Recurse into nested content
                    citations.extend(extract_citations_from_note(item))
        return citations

    def process_char(char: dict[str, Any]) -> None:
        """Process a char element (may contain Strong's number or nested content)."""
        nonlocal current_words

        marker = char.get("marker")
        content = char.get("content", [])

        if marker == "w" and char.get("strong"):
            # Word with Strong's number - only process if we're in a verse
            if current_verse > 0:
                text = extract_text(content)
                strongs = normalize_strongs(char["strong"])
                current_words.append((text, strongs))
        else:
            # Other char types (wj, add, etc.) - may contain nested verses/words
            # Process content recursively to find verses and words inside
            process_content(content)

    def clean_words(words: list[tuple[str, str | None]]) -> list[tuple[str, str | None]]:
        """Clean and normalize word array with proper spacing."""
        result: list[tuple[str, str | None]] = []

        for text, strongs in words:
            # Skip empty text
            if not text and not strongs:
                continue

            # Normalize whitespace in text
            text = re.sub(r"\s+", " ", text)

            # Merge with previous if both have no strongs
            if strongs is None and result and result[-1][1] is None:
                result[-1] = (result[-1][0] + text, None)
            else:
                # Add space before this word if needed
                if result and strongs is not None:
                    prev_text, prev_strongs = result[-1]
                    # Check if we need a space between words
                    needs_space = False
                    if prev_text:
                        last_char = prev_text[-1]
                        first_char = text[0] if text else ""
                        # Characters that shouldn't have space after them
                        no_space_after = ' "\'(["\u201c\u2018'
                        # Characters that shouldn't have space before them
                        no_space_before = ',.;:!?)]\'""\u201d\u2019'
                        # Don't add space after opening punctuation
                        if last_char in no_space_after:
                            needs_space = False
                        # Don't add space before closing punctuation
                        elif first_char in no_space_before:
                            needs_space = False
                        # Add space between words
                        else:
                            needs_space = True
                    if needs_space:
                        result.append((" ", None))
                result.append((text, strongs))

        # Merge adjacent non-strongs entries
        merged: list[tuple[str, str | None]] = []
        for text, strongs in result:
            if strongs is None and merged and merged[-1][1] is None:
                merged[-1] = (merged[-1][0] + text, None)
            else:
                merged.append((text, strongs))

        # Trim leading/trailing whitespace from first and last entries
        if merged:
            merged[0] = (merged[0][0].lstrip(), merged[0][1])
            merged[-1] = (merged[-1][0].rstrip(), merged[-1][1])

        return merged

    def save_current_verse() -> None:
        """Save the current verse if valid."""
        nonlocal current_words, current_citations
        if current_book and current_chapter > 0 and current_verse > 0 and current_words:
            # Clean up words - merge adjacent null-strongs entries and add spacing
            cleaned_words = clean_words(current_words)

            # Convert to list format for JSON serialization
            w_list: list[tuple[str, str | None]] = [(t, s) for t, s in cleaned_words]

            verse_data: DisplayVerse = {
                "b": current_book,
                "c": current_chapter,
                "v": current_verse,
                "w": w_list,
            }

            # Add citations if present
            if current_citations:
                verse_data["citations"] = current_citations.copy()  # type: ignore

            verses.append(verse_data)
        current_words = []
        current_citations = []

    def process_content(content: list[Any]) -> None:
        """Recursive function to process content."""
        nonlocal current_book, current_chapter, current_verse, current_words, current_citations

        for item in content:
            if isinstance(item, str):
                # Plain text (punctuation, spaces, etc.)
                if item.strip() or item == " ":
                    add_text(item)
            elif isinstance(item, dict):
                item_type = item.get("type")

                if item_type == "book":
                    # Extract book code
                    current_book = item.get("code", "")
                elif item_type == "chapter":
                    # Save previous verse if exists
                    save_current_verse()
                    current_chapter = int(item.get("number", 0))
                    current_verse = 0
                elif item_type == "verse":
                    # Save previous verse if exists
                    save_current_verse()
                    current_verse = int(item.get("number", 0))
                    current_words = []
                    current_citations = []
                elif item_type == "para":
                    # Skip section headers (s1, s2, etc.) and references (r)
                    marker = item.get("marker", "")
                    if marker in ("s1", "s2", "s3", "s4", "s5", "r", "sr", "mr", "d"):
                        # Don't include section headers or references in verse text
                        continue
                    # Process paragraph content
                    if "content" in item:
                        process_content(item["content"])
                elif item_type == "char":
                    # Character style - may contain Strong's number
                    process_char(item)
                elif item_type == "note":
                    # Footnote - extract citations but don't include note text
                    citations = extract_citations_from_note(item)
                    if citations:
                        current_citations.extend(citations)
                    # Don't process note content as verse text
                elif "content" in item:
                    # Other elements with content - recurse
                    process_content(item["content"])

    # Process the document
    process_content(usj.get("content", []))

    # Save final verse
    save_current_verse()

    return verses


def get_book_code_from_filename(filename: str) -> str:
    """
    Get book code from USJ filename.
    Format: "01GENBSB_full_strongs.usj" -> "GEN"
    """
    match = re.match(r"^\d{2}([A-Z0-9]+)BSB", filename)
    if not match:
        raise ValueError(f"Cannot extract book code from filename: {filename}")
    return match.group(1)
