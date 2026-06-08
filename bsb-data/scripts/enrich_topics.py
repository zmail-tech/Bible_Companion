"""Add Nave's Topical Bible tags to verse data."""

import re
import xml.etree.ElementTree as ET
from typing import Any

from .types import BOOK_NUMBERS
from .utils import NAVES_DIR, log, verse_id

# Mapping from CCEL/OSIS book abbreviations to our book codes
OSIS_TO_BOOK_CODE = {
    "Gen": "GEN",
    "Exod": "EXO",
    "Lev": "LEV",
    "Num": "NUM",
    "Deut": "DEU",
    "Josh": "JOS",
    "Judg": "JDG",
    "Ruth": "RUT",
    "1Sam": "1SA",
    "2Sam": "2SA",
    "1Kgs": "1KI",
    "2Kgs": "2KI",
    "1Chr": "1CH",
    "2Chr": "2CH",
    "Ezra": "EZR",
    "Neh": "NEH",
    "Esth": "EST",
    "Job": "JOB",
    "Ps": "PSA",
    "Prov": "PRO",
    "Eccl": "ECC",
    "Song": "SNG",
    "Isa": "ISA",
    "Jer": "JER",
    "Lam": "LAM",
    "Ezek": "EZK",
    "Dan": "DAN",
    "Hos": "HOS",
    "Joel": "JOL",
    "Amos": "AMO",
    "Obad": "OBA",
    "Jonah": "JON",
    "Mic": "MIC",
    "Nah": "NAM",
    "Hab": "HAB",
    "Zeph": "ZEP",
    "Hag": "HAG",
    "Zech": "ZEC",
    "Mal": "MAL",
    "Matt": "MAT",
    "Mark": "MRK",
    "Luke": "LUK",
    "John": "JHN",
    "Acts": "ACT",
    "Rom": "ROM",
    "1Cor": "1CO",
    "2Cor": "2CO",
    "Gal": "GAL",
    "Eph": "EPH",
    "Phil": "PHP",
    "Col": "COL",
    "1Thess": "1TH",
    "2Thess": "2TH",
    "1Tim": "1TI",
    "2Tim": "2TI",
    "Titus": "TIT",
    "Phlm": "PHM",
    "Heb": "HEB",
    "Jas": "JAS",
    "1Pet": "1PE",
    "2Pet": "2PE",
    "1John": "1JN",
    "2John": "2JN",
    "3John": "3JN",
    "Jude": "JUD",
    "Rev": "REV",
}


def parse_osis_ref(osis_ref: str) -> list[tuple[str, int, int]]:
    """
    Parse OSIS reference like "Bible:Gen.1.1" or "Bible:Gen.1.1-Gen.1.3"
    Returns list of (book_code, chapter, verse) tuples.
    """
    results = []

    # Remove "Bible:" prefix if present
    if osis_ref.startswith("Bible:"):
        osis_ref = osis_ref[6:]

    # Handle ranges like "Gen.1.1-Gen.1.3"
    if "-" in osis_ref:
        parts = osis_ref.split("-")
        if len(parts) == 2:
            start = parse_single_osis_ref(parts[0])
            end = parse_single_osis_ref(parts[1])
            if start and end and start[0] == end[0] and start[1] == end[1]:
                # Same book and chapter - expand range
                book, chapter, start_verse = start
                _, _, end_verse = end
                for v in range(start_verse, end_verse + 1):
                    results.append((book, chapter, v))
                return results
            elif start:
                # Just use start reference for cross-book/chapter ranges
                results.append(start)
                return results
    else:
        ref = parse_single_osis_ref(osis_ref)
        if ref:
            results.append(ref)

    return results


def parse_single_osis_ref(ref: str) -> tuple[str, int, int] | None:
    """Parse single OSIS reference like 'Gen.1.1' -> ('GEN', 1, 1)"""
    # Pattern: Book.Chapter.Verse
    match = re.match(r"(\d?\w+)\.(\d+)\.(\d+)", ref)
    if match:
        osis_book = match.group(1)
        chapter = int(match.group(2))
        verse = int(match.group(3))

        book_code = OSIS_TO_BOOK_CODE.get(osis_book)
        if book_code and book_code in BOOK_NUMBERS:
            return (book_code, chapter, verse)

    return None


def load_topics() -> dict[str, list[str]]:
    """
    Load Nave's Topical Bible data from CCEL ThML XML.
    Returns a dict mapping verse IDs to lists of topic names.
    """
    naves_path = NAVES_DIR / "naves-topical-bible.xml"

    if not naves_path.exists():
        log("WARNING: No Nave's topics file found")
        log(f"  Expected: {naves_path}")
        log("  Run: bash scripts/fetch-sources.sh")
        return {}

    log(f"Loading topics from {naves_path.name}")

    # Parse XML
    try:
        tree = ET.parse(naves_path)
        root = tree.getroot()
    except ET.ParseError as e:
        log(f"WARNING: Could not parse Nave's XML: {e}")
        return {}

    topics: dict[str, list[str]] = {}
    current_topic = None
    topic_count = 0

    # Find all term and scripRef elements
    # ThML structure: <glossary><term>TOPIC</term><def>...<scripRef>...</scripRef>...</def></glossary>
    for elem in root.iter():
        if elem.tag == "term":
            current_topic = elem.text
            if current_topic:
                current_topic = current_topic.strip()
                topic_count += 1

        elif elem.tag == "scripRef" and current_topic:
            # Get OSIS reference from osisRef attribute
            osis_ref = elem.get("osisRef", "")
            if osis_ref:
                refs = parse_osis_ref(osis_ref)
                for book, chapter, verse in refs:
                    vid = verse_id(book, chapter, verse)
                    if vid not in topics:
                        topics[vid] = []
                    if current_topic not in topics[vid]:
                        topics[vid].append(current_topic)

    if topics:
        log(f"Loaded {len(topics)} verses with topics from {topic_count} topics")
        total_assignments = sum(len(t) for t in topics.values())
        log(f"Total topic assignments: {total_assignments}")
    else:
        log("WARNING: Could not parse topics from Nave's XML")

    return topics


def enrich_with_topics(
    verses: list[dict[str, Any]], topics: dict[str, list[str]]
) -> list[dict[str, Any]]:
    """Add topics to verse data."""
    enriched = []

    for verse in verses:
        vid = verse_id(verse["b"], verse["c"], verse["v"])
        verse_topics = topics.get(vid, [])

        enriched_verse = {**verse, "tp": verse_topics}
        enriched.append(enriched_verse)

    return enriched
