"""Extract image and map links from WLC MARBLE Index.

This module processes the MARBLE (Multi-Application Repository for the
Biblical Languages of the Eastern Mediterranean) index files to extract:
- ImageLinks: References to illustrations (e.g., "WEB-0195_the_earth")
- MapLinks: Geographic coordinates for locations mentioned

MARBLE ID format: [type]BBCCCVVVWWWW
- type: 'o' for OT word
- BB: Book number (01-39)
- CCC: Chapter number
- VVV: Verse number
- WWWW: Word position

License: CC-BY-SA 4.0 (United Bible Societies)
"""

import json
from pathlib import Path
from typing import Any

from .utils import MARBLE_DIR, log

# Map MARBLE book numbers to our book codes
MARBLE_BOOK_MAP = {
    1: "GEN",
    2: "EXO",
    3: "LEV",
    4: "NUM",
    5: "DEU",
    6: "JOS",
    7: "JDG",
    8: "RUT",
    9: "1SA",
    10: "2SA",
    11: "1KI",
    12: "2KI",
    13: "1CH",
    14: "2CH",
    15: "EZR",
    16: "NEH",
    17: "EST",
    18: "JOB",
    19: "PSA",
    20: "PRO",
    21: "ECC",
    22: "SNG",
    23: "ISA",
    24: "JER",
    25: "LAM",
    26: "EZK",
    27: "DAN",
    28: "HOS",
    29: "JOL",
    30: "AMO",
    31: "OBA",
    32: "JON",
    33: "MIC",
    34: "NAM",
    35: "HAB",
    36: "ZEP",
    37: "HAG",
    38: "ZEC",
    39: "MAL",
}

# Book codes used in MARBLE filenames
MARBLE_BOOK_FILES = [
    "GEN",
    "EXO",
    "LEV",
    "NUM",
    "DEU",
    "JOS",
    "JDG",
    "RUT",
    "1SA",
    "2SA",
    "1KI",
    "2KI",
    "1CH",
    "2CH",
    "EZR",
    "NEH",
    "EST",
    "JOB",
    "PSA",
    "PRO",
    "ECC",
    "SNG",
    "ISA",
    "JER",
    "LAM",
    "EZK",
    "DAN",
    "HOS",
    "JOL",
    "AMO",
    "OBA",
    "JON",
    "MIC",
    "NAM",
    "HAB",
    "ZEP",
    "HAG",
    "ZEC",
    "MAL",
]

# Base URL for MARBLE images
MARBLE_IMAGE_BASE = "https://github.com/ubsicap/ubs-open-license/raw/main/images/"


def parse_marble_id(marble_id: str) -> tuple[str, int, int, int] | None:
    """
    Parse MARBLE ID to (book_code, chapter, verse, word_pos).

    Format: o + BB + CCC + VVV + WWWW (13 chars total)
    Returns None if parsing fails.
    """
    if not marble_id or len(marble_id) != 13:
        return None

    if marble_id[0] != "o":  # Only OT words
        return None

    try:
        book_num = int(marble_id[1:3])
        chapter = int(marble_id[3:6])
        verse = int(marble_id[6:9])
        word_pos = int(marble_id[9:13])

        book_code = MARBLE_BOOK_MAP.get(book_num)
        if not book_code:
            return None

        return (book_code, chapter, verse, word_pos)
    except (ValueError, IndexError):
        return None


def build_marble_index() -> dict[str, dict[str, Any]]:
    """
    Build an index mapping verse IDs to image and map links.

    Returns dict: {
        "GEN.1.1": {
            "img": ["WEB-0195_the_earth"],  # Image references
            "map": ["35.09,40.42"],  # Lat,lng coordinates
            "sense": {  # Word-level sense data from LexicalLinks
                "12": {"lemma": "ראשית", "domain": "Begin", "sense": "000000"}
            }
        }
    }
    """
    marble_index: dict[str, dict[str, Any]] = {}

    if not MARBLE_DIR.exists():
        log(f"WARNING: MARBLE directory not found at {MARBLE_DIR}")
        log("  Run: bash scripts/fetch-sources.sh")
        return marble_index

    files_processed = 0
    entries_processed = 0

    for book_code in MARBLE_BOOK_FILES:
        file_path = MARBLE_DIR / f"MARBLELinks-{book_code}.json"
        if not file_path.exists():
            continue

        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            log(f"WARNING: Failed to load {file_path.name}: {e}")
            continue

        files_processed += 1

        for entry in data:
            marble_id = entry.get("ID")
            if not marble_id:
                continue

            parsed = parse_marble_id(marble_id)
            if not parsed:
                continue

            book, chapter, verse, word_pos = parsed
            verse_id = f"{book}.{chapter}.{verse}"

            # Extract relevant links
            image_links = entry.get("ImageLinks", [])
            map_links = entry.get("MapLinks", [])
            lexical_links = entry.get("LexicalLinks", [])

            # Skip entries with no useful data
            if not (image_links or map_links or lexical_links):
                continue

            entries_processed += 1

            if verse_id not in marble_index:
                marble_index[verse_id] = {}

            verse_data = marble_index[verse_id]

            # Add image links (verse-level, deduplicated)
            if image_links:
                if "img" not in verse_data:
                    verse_data["img"] = []
                for img in image_links:
                    if img and img not in verse_data["img"]:
                        verse_data["img"].append(img)

            # Add map links (verse-level, deduplicated)
            if map_links:
                if "map" not in verse_data:
                    verse_data["map"] = []
                for coords in map_links:
                    if coords and coords not in verse_data["map"]:
                        verse_data["map"].append(coords)

            # Add sense data from LexicalLinks (word-level)
            # Format: "SDBH:lemma:senseId:domain"
            if lexical_links:
                if "sense" not in verse_data:
                    verse_data["sense"] = {}

                for link in lexical_links:
                    parts = link.split(":")
                    if len(parts) >= 4 and parts[0] == "SDBH":
                        lemma = parts[1]
                        sense_id = parts[2]
                        domain = parts[3]

                        verse_data["sense"][str(word_pos)] = {
                            "lem": lemma,
                            "dom": domain,
                            "sid": sense_id,
                        }

    log(f"  Processed {files_processed} MARBLE files, {entries_processed} entries")
    log(f"  Verses with media links: {len(marble_index)}")

    # Count totals
    img_count = sum(1 for v in marble_index.values() if v.get("img"))
    map_count = sum(1 for v in marble_index.values() if v.get("map"))
    sense_count = sum(1 for v in marble_index.values() if v.get("sense"))
    log(f"  Verses with images: {img_count}, maps: {map_count}, sense data: {sense_count}")

    return marble_index


def enrich_with_marble(
    verses: list[dict[str, Any]],
    marble_index: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Add MARBLE media links to verses.

    Adds to each verse (where available):
    - 'img': List of image references
    - 'map': List of coordinate strings (lat,lng)
    - 'msense': Word-level sense data from MARBLE LexicalLinks
    """
    enriched = []
    img_added = 0
    map_added = 0
    sense_added = 0

    for verse in verses:
        verse_id = verse.get("id")
        enriched_verse = {**verse}

        if verse_id and verse_id in marble_index:
            marble_data = marble_index[verse_id]

            if marble_data.get("img"):
                enriched_verse["img"] = marble_data["img"]
                img_added += 1

            if marble_data.get("map"):
                enriched_verse["map"] = marble_data["map"]
                map_added += 1

            if marble_data.get("sense"):
                enriched_verse["msense"] = marble_data["sense"]
                sense_added += 1

        enriched.append(enriched_verse)

    log(f"  Added images to {img_added}, maps to {map_added}, sense to {sense_added} verses")
    return enriched
