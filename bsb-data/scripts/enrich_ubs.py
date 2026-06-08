"""Add UBS Dictionary enrichment to verse data.

This module loads the UBS Dictionary of Biblical Hebrew and Greek,
providing richer lexical data than the basic Strong's definitions:
- Precise semantic definitions
- Multiple glosses per word sense
- Semantic domain classification
- Multiple distinguished senses per lemma

License: CC-BY-SA 4.0 (United Bible Societies)
"""

import json
from pathlib import Path
from typing import Any

from .utils import SOURCES_DIR, log

UBS_DIR = SOURCES_DIR / "ubs-dictionaries"


def normalize_strong(code: str) -> str | None:
    """
    Normalize Strong's code from UBS format to standard format.

    UBS uses: H0001, G0002, A0003 (Aramaic)
    We want: H1, G2 (skip Aramaic-only)
    """
    if not code:
        return None
    code = code.upper()

    # Skip Aramaic-only codes
    if code.startswith("A"):
        return None

    if code.startswith(("H", "G")):
        prefix = code[0]
        num = code[1:].lstrip("0") or "0"
        return f"{prefix}{num}"

    return None


def extract_ubs_entry(entry: dict) -> dict:
    """
    Extract useful fields from a UBS dictionary entry.

    Returns a dict with:
    - lemma: The Hebrew/Greek word
    - senses: List of {def, glosses} for each meaning
    - domains: Set of semantic domains
    - core_domains: Set of high-level thematic domains
    - pos: Part of speech (if available)
    """
    result: dict[str, Any] = {
        "lemma": entry.get("Lemma", ""),
        "senses": [],
        "domains": set(),
        "core_domains": set(),
    }

    for base_form in entry.get("BaseForms", []):
        # Get part of speech
        pos_list = base_form.get("PartsOfSpeech", [])
        if pos_list and "pos" not in result:
            result["pos"] = pos_list[0]

        for meaning in base_form.get("LEXMeanings", []):
            sense: dict[str, Any] = {}

            # Get sense info from English entry
            for lex_sense in meaning.get("LEXSenses", []):
                if lex_sense.get("LanguageCode") == "en":
                    def_short = lex_sense.get("DefinitionShort", "")
                    glosses = lex_sense.get("Glosses", [])

                    if def_short:
                        sense["def"] = def_short
                    if glosses:
                        sense["glosses"] = glosses
                    break

            # Collect domains (can be None or missing)
            lex_domains = meaning.get("LEXDomains") or []
            for dom in lex_domains:
                domain = dom.get("Domain")
                if domain:
                    result["domains"].add(domain)

            # Collect core domains (higher-level thematic categories, can be None)
            core_domains = meaning.get("LEXCoreDomains") or []
            for dom in core_domains:
                domain = dom.get("Domain")
                if domain:
                    result["core_domains"].add(domain)

            # Only add sense if it has content
            if sense.get("def") or sense.get("glosses"):
                result["senses"].append(sense)

    # Convert sets to sorted lists for JSON serialization
    result["domains"] = sorted(result["domains"])
    result["core_domains"] = sorted(result["core_domains"])

    return result


def load_ubs_hebrew() -> dict[str, dict]:
    """
    Load UBS Hebrew dictionary, indexed by Strong's number.

    Returns dict mapping Strong's numbers (e.g., "H1") to entry data.
    """
    path = UBS_DIR / "UBSHebrewDic-en.json"
    if not path.exists():
        log(f"WARNING: UBS Hebrew dictionary not found at {path}")
        log("  Run: bash scripts/fetch-sources.sh")
        return {}

    log(f"Loading UBS Hebrew dictionary from {path.name}")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        log(f"WARNING: Failed to parse UBS Hebrew dictionary: {e}")
        return {}

    lexicon: dict[str, dict] = {}

    for entry in data:
        strong_codes = entry.get("StrongCodes", [])
        for strong in strong_codes:
            normalized = normalize_strong(strong)
            if normalized and normalized.startswith("H"):
                if normalized not in lexicon:
                    lexicon[normalized] = extract_ubs_entry(entry)

    log(f"  Loaded {len(lexicon)} Hebrew entries")
    return lexicon


def load_ubs_greek() -> dict[str, dict]:
    """
    Load UBS Greek dictionary, indexed by Strong's number.

    Returns dict mapping Strong's numbers (e.g., "G1") to entry data.
    """
    path = UBS_DIR / "UBSGreekNTDic-en.json"
    if not path.exists():
        log(f"WARNING: UBS Greek dictionary not found at {path}")
        log("  Run: bash scripts/fetch-sources.sh")
        return {}

    log(f"Loading UBS Greek dictionary from {path.name}")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        log(f"WARNING: Failed to parse UBS Greek dictionary: {e}")
        return {}

    lexicon: dict[str, dict] = {}

    for entry in data:
        strong_codes = entry.get("StrongCodes", [])
        for strong in strong_codes:
            normalized = normalize_strong(strong)
            if normalized and normalized.startswith("G"):
                if normalized not in lexicon:
                    lexicon[normalized] = extract_ubs_entry(entry)

    log(f"  Loaded {len(lexicon)} Greek entries")
    return lexicon


def load_ubs_lexicon() -> dict[str, dict]:
    """
    Load both Hebrew and Greek UBS dictionaries.

    Returns combined dict mapping all Strong's numbers to entry data.
    """
    hebrew = load_ubs_hebrew()
    greek = load_ubs_greek()

    # Merge (no overlap since H* and G* are distinct)
    combined = {**hebrew, **greek}

    if combined:
        log(f"  Total UBS entries: {len(combined)}")

    return combined


def enrich_with_ubs(
    verses: list[dict[str, Any]],
    ubs_lexicon: dict[str, dict],
) -> list[dict[str, Any]]:
    """
    Add UBS lexicon data to verses.

    Replaces the 'g' field with richer UBS data:
    - g: dict mapping Strong's -> {lemma, glosses, def}
    - dom: list of core semantic domains for the verse

    Args:
        verses: List of verse dicts with 's' field containing Strong's numbers
        ubs_lexicon: Combined UBS lexicon from load_ubs_lexicon()

    Returns:
        Enriched verses with UBS data
    """
    enriched = []

    for verse in verses:
        strongs_nums = verse.get("s", [])

        # Build UBS gloss data for this verse
        glosses: dict[str, dict] = {}
        verse_domains: set[str] = set()

        for s in strongs_nums:
            if s in ubs_lexicon:
                entry = ubs_lexicon[s]

                # Build compact gloss entry
                gloss_entry: dict[str, Any] = {}

                if entry.get("lemma"):
                    gloss_entry["lemma"] = entry["lemma"]

                # Use first sense's glosses and definition
                if entry.get("senses"):
                    first_sense = entry["senses"][0]
                    if first_sense.get("glosses"):
                        gloss_entry["glosses"] = first_sense["glosses"]
                    if first_sense.get("def"):
                        gloss_entry["def"] = first_sense["def"]

                if gloss_entry:
                    glosses[s] = gloss_entry

                # Collect core domains for verse-level tagging
                verse_domains.update(entry.get("core_domains", []))

        # Build enriched verse
        enriched_verse = {**verse}
        enriched_verse["g"] = glosses

        # Add semantic domains if any
        if verse_domains:
            enriched_verse["dom"] = sorted(verse_domains)

        enriched.append(enriched_verse)

    return enriched
