"""Extract sense-level word data from UBS Scripture References.

This module maps each word occurrence in the Bible to its specific sense/meaning
using the LEXReferences data from UBS dictionaries. This enables disambiguation
of polysemous words (e.g., distinguishing "father" as parent vs. ancestor vs. founder).

UBS Reference format: BBB CCC VVV WWWWW (14 digits)
- BBB: Book number (001-039 OT, 040-066 NT)
- CCC: Chapter number
- VVV: Verse number
- WWWWW: Word position within verse

License: CC-BY-SA 4.0 (United Bible Societies)
"""

import json
from pathlib import Path
from typing import Any

from .utils import SOURCES_DIR, log

UBS_DIR = SOURCES_DIR / "ubs-dictionaries"

# Map UBS book numbers to our book codes
UBS_BOOK_MAP = {
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
    40: "MAT",
    41: "MRK",
    42: "LUK",
    43: "JHN",
    44: "ACT",
    45: "ROM",
    46: "1CO",
    47: "2CO",
    48: "GAL",
    49: "EPH",
    50: "PHP",
    51: "COL",
    52: "1TH",
    53: "2TH",
    54: "1TI",
    55: "2TI",
    56: "TIT",
    57: "PHM",
    58: "HEB",
    59: "JAS",
    60: "1PE",
    61: "2PE",
    62: "1JN",
    63: "2JN",
    64: "3JN",
    65: "JUD",
    66: "REV",
}


def parse_ubs_reference(ref: str) -> tuple[str, int, int, int] | None:
    """
    Parse UBS 14-digit reference to (book_code, chapter, verse, word_pos).

    Format: BBBCCCVVVWWWWW
    Returns None if parsing fails.
    """
    if not ref or len(ref) != 14 or not ref.isdigit():
        return None

    try:
        book_num = int(ref[0:3])
        chapter = int(ref[3:6])
        verse = int(ref[6:9])
        word_pos = int(ref[9:14])

        book_code = UBS_BOOK_MAP.get(book_num)
        if not book_code:
            return None

        return (book_code, chapter, verse, word_pos)
    except (ValueError, IndexError):
        return None


def build_sense_index(ubs_data: list[dict]) -> dict[str, dict[str, Any]]:
    """
    Build an index mapping verse IDs to word sense data.

    Returns dict: {
        "GEN.1.1": {
            word_positions: {
                12: {"sense_idx": 0, "gloss": "beginning"},
                21: {"sense_idx": 0, "gloss": "create"},
                ...
            }
        }
    }

    The sense_idx corresponds to the index in the LEXMeanings array,
    allowing apps to show the specific meaning for that occurrence.
    """
    sense_index: dict[str, dict[str, Any]] = {}

    for entry in ubs_data:
        strong_codes = entry.get("StrongCodes", [])
        if not strong_codes:
            continue

        # Get the primary Strong's code (normalized)
        primary_strong = None
        for code in strong_codes:
            if code and code.upper().startswith(("H", "G")):
                prefix = code[0].upper()
                num = code[1:].lstrip("0") or "0"
                primary_strong = f"{prefix}{num}"
                break

        if not primary_strong:
            continue

        # Process each meaning (sense)
        for base_form in entry.get("BaseForms", []):
            for sense_idx, meaning in enumerate(base_form.get("LEXMeanings", [])):
                # Get the gloss for this sense
                gloss = None
                for lex_sense in meaning.get("LEXSenses", []):
                    if lex_sense.get("LanguageCode") == "en":
                        glosses = lex_sense.get("Glosses", [])
                        if glosses:
                            gloss = glosses[0]  # First gloss
                        break

                # Process all references for this sense
                refs = meaning.get("LEXReferences") or []
                for ref in refs:
                    parsed = parse_ubs_reference(ref)
                    if not parsed:
                        continue

                    book_code, chapter, verse, word_pos = parsed
                    verse_id = f"{book_code}.{chapter}.{verse}"

                    if verse_id not in sense_index:
                        sense_index[verse_id] = {"wp": {}}

                    # Store sense data for this word position
                    sense_data: dict[str, Any] = {
                        "si": sense_idx,  # sense index
                        "s": primary_strong,  # Strong's number
                    }
                    if gloss:
                        sense_data["gl"] = gloss  # specific gloss for this sense

                    sense_index[verse_id]["wp"][word_pos] = sense_data

    return sense_index


def load_ubs_sense_index() -> dict[str, dict[str, Any]]:
    """
    Load UBS dictionaries and build combined sense index.

    Returns dict mapping verse IDs to word sense data.
    """
    hebrew_path = UBS_DIR / "UBSHebrewDic-en.json"
    greek_path = UBS_DIR / "UBSGreekNTDic-en.json"

    combined_index: dict[str, dict[str, Any]] = {}

    # Process Hebrew dictionary
    if hebrew_path.exists():
        log(f"Building sense index from {hebrew_path.name}")
        try:
            hebrew_data = json.loads(hebrew_path.read_text(encoding="utf-8"))
            hebrew_index = build_sense_index(hebrew_data)
            log(f"  Hebrew: {len(hebrew_index)} verses with sense data")

            # Merge into combined index
            for verse_id, data in hebrew_index.items():
                if verse_id not in combined_index:
                    combined_index[verse_id] = {"wp": {}}
                combined_index[verse_id]["wp"].update(data["wp"])
        except (json.JSONDecodeError, OSError) as e:
            log(f"WARNING: Failed to load Hebrew dictionary: {e}")
    else:
        log(f"WARNING: Hebrew dictionary not found at {hebrew_path}")

    # Process Greek dictionary
    if greek_path.exists():
        log(f"Building sense index from {greek_path.name}")
        try:
            greek_data = json.loads(greek_path.read_text(encoding="utf-8"))
            greek_index = build_sense_index(greek_data)
            log(f"  Greek: {len(greek_index)} verses with sense data")

            # Merge into combined index
            for verse_id, data in greek_index.items():
                if verse_id not in combined_index:
                    combined_index[verse_id] = {"wp": {}}
                combined_index[verse_id]["wp"].update(data["wp"])
        except (json.JSONDecodeError, OSError) as e:
            log(f"WARNING: Failed to load Greek dictionary: {e}")
    else:
        log(f"WARNING: Greek dictionary not found at {greek_path}")

    log(f"  Total verses with sense data: {len(combined_index)}")
    return combined_index


def enrich_with_sense_data(
    verses: list[dict[str, Any]],
    sense_index: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Add sense disambiguation data to verses.

    Adds 'ws' (word senses) field to each verse that has sense data:
    {
        "ws": {
            "12": {"si": 0, "s": "H1", "gl": "beginning"},
            "21": {"si": 0, "s": "H1254", "gl": "create"}
        }
    }

    The keys are word positions, values contain:
    - si: sense index (which meaning in the lexicon)
    - s: Strong's number
    - gl: specific gloss for this sense (optional)
    """
    enriched = []
    enriched_count = 0

    for verse in verses:
        verse_id = verse.get("id")
        enriched_verse = {**verse}

        if verse_id and verse_id in sense_index:
            sense_data = sense_index[verse_id]
            if sense_data.get("wp"):
                # Convert int keys to string for JSON compatibility
                enriched_verse["ws"] = {str(k): v for k, v in sense_data["wp"].items()}
                enriched_count += 1

        enriched.append(enriched_verse)

    log(f"  Added sense data to {enriched_count} verses")
    return enriched
