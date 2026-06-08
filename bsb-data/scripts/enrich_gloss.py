"""Add Strong's glosses/definitions to verse data.

This module provides two functions:
1. load_strongs_lexicon() - Basic glosses for PD (public domain) output
2. load_strongs_pronunciation() - Transliteration/pronunciation data to merge with UBS
"""

import json
import re
from pathlib import Path
from typing import Any

from .utils import STRONGS_DIR, extract_strongs_from_words, log


def load_strongs_js_file(path: Path) -> dict[str, dict]:
    """
    Load Strong's dictionary from OpenScriptures JS format.
    The file contains: var strongsHebrewDictionary = {...};
    followed by: module.exports = ...
    """
    content = path.read_text(encoding="utf-8")

    # Find where the JSON object starts
    start_match = re.search(r"var\s+\w+\s*=\s*(\{\"[HG]\d+\")", content)
    if not start_match:
        log(f"WARNING: Could not find JSON start in: {path}")
        return {}

    # Find where it ends - look for }; followed by module.exports or end
    # The JSON ends with }}; (last entry closes with }, then object closes with })
    json_start = start_match.start(1)

    # Find the end: either "};\n\nmodule" or "}; module" pattern
    end_match = re.search(r"\};\s*(?:module\.exports|\Z)", content[json_start:])
    if not end_match:
        log(f"WARNING: Could not find JSON end in: {path}")
        return {}

    json_str = content[json_start : json_start + end_match.start() + 1]

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        log(f"WARNING: JSON decode error in {path}: {e}")
        return {}


def load_strongs_lexicon() -> dict[str, str]:
    """
    Load Strong's lexicon data from OpenScriptures.
    Returns a dict mapping Strong's numbers to short glosses.

    Used for PD (public domain) output where we need basic definitions.
    """
    lexicon: dict[str, str] = {}

    # OpenScriptures Strong's dictionary files
    hebrew_path = STRONGS_DIR / "strongs-hebrew-dictionary.js"
    greek_path = STRONGS_DIR / "strongs-greek-dictionary.js"

    for path in [hebrew_path, greek_path]:
        if not path.exists():
            continue

        log(f"Loading Strong's data from {path.name}")
        data = load_strongs_js_file(path)

        for key, value in data.items():
            # Keys are like "H1", "H2", "G1", etc.
            strongs_num = key.upper()

            if isinstance(value, dict):
                # Extract gloss - prefer strongs_def, fall back to kjv_def
                gloss = value.get("strongs_def", "")
                if not gloss:
                    gloss = value.get("kjv_def", "")

                # Clean up the gloss - remove braces and trim
                if gloss:
                    gloss = gloss.strip()
                    # Remove surrounding braces like {father}
                    if gloss.startswith("{") and gloss.endswith("}"):
                        gloss = gloss[1:-1]
                    # Truncate very long definitions
                    if len(gloss) > 150:
                        gloss = gloss[:147] + "..."

                if gloss and strongs_num not in lexicon:
                    lexicon[strongs_num] = gloss

    if lexicon:
        log(f"Loaded {len(lexicon)} Strong's definitions")
    else:
        log("WARNING: Could not load Strong's lexicon data")
        log(f"  Checked: {hebrew_path} (exists: {hebrew_path.exists()})")
        log(f"  Checked: {greek_path} (exists: {greek_path.exists()})")
        log("  Run: bash scripts/fetch-sources.sh")

    return lexicon


def load_strongs_pronunciation() -> dict[str, dict[str, str]]:
    """
    Load transliteration and pronunciation data from OpenScriptures Strong's.

    Returns a dict mapping Strong's numbers to {xlit, pron}:
    - xlit: Transliteration (e.g., "ʼâb" for H1)
    - pron: Pronunciation guide (e.g., "awb" for H1)

    Used to supplement UBS data which lacks this information.
    """
    pronunciation: dict[str, dict[str, str]] = {}

    hebrew_path = STRONGS_DIR / "strongs-hebrew-dictionary.js"
    greek_path = STRONGS_DIR / "strongs-greek-dictionary.js"

    for path in [hebrew_path, greek_path]:
        if not path.exists():
            continue

        log(f"Loading pronunciation data from {path.name}")
        data = load_strongs_js_file(path)

        for key, value in data.items():
            strongs_num = key.upper()

            if isinstance(value, dict):
                entry: dict[str, str] = {}

                xlit = value.get("xlit", "")
                if xlit:
                    entry["xlit"] = xlit

                pron = value.get("pron", "")
                if pron:
                    entry["pron"] = pron

                if entry and strongs_num not in pronunciation:
                    pronunciation[strongs_num] = entry

    if pronunciation:
        log(f"  Loaded pronunciation for {len(pronunciation)} entries")

    return pronunciation


def enrich_with_glosses(
    verses: list[dict[str, Any]], lexicon: dict[str, str]
) -> list[dict[str, Any]]:
    """Add Strong's glosses to verse data (for PD output)."""
    enriched = []

    for verse in verses:
        # Get Strong's numbers from this verse
        # Try 's' (strongs list in index format) first, then 'w' (words)
        strongs_nums = verse.get("s", [])
        if not strongs_nums:
            words = verse.get("w", [])
            strongs_nums = extract_strongs_from_words(words)

        # Build glosses dict for this verse
        glosses: dict[str, str] = {}
        for s in strongs_nums:
            if s in lexicon:
                glosses[s] = lexicon[s]

        enriched_verse = {**verse, "g": glosses}
        enriched.append(enriched_verse)

    return enriched


def merge_pronunciation_with_ubs(
    ubs_glosses: dict[str, dict],
    pronunciation: dict[str, dict[str, str]],
) -> dict[str, dict]:
    """
    Merge OpenScriptures pronunciation data into UBS gloss entries.

    Adds 'xlit' and 'pron' fields to each UBS entry where available.

    Args:
        ubs_glosses: Dict from enrich_ubs (Strong's -> {lemma, glosses, def})
        pronunciation: Dict from load_strongs_pronunciation (Strong's -> {xlit, pron})

    Returns:
        Merged dict with pronunciation data added to UBS entries
    """
    merged = {}

    for strongs_num, ubs_entry in ubs_glosses.items():
        merged_entry = {**ubs_entry}

        if strongs_num in pronunciation:
            pron_data = pronunciation[strongs_num]
            if "xlit" in pron_data:
                merged_entry["xlit"] = pron_data["xlit"]
            if "pron" in pron_data:
                merged_entry["pron"] = pron_data["pron"]

        merged[strongs_num] = merged_entry

    return merged
