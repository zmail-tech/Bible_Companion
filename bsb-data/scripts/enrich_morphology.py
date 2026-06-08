"""Add OSHB morphology data to verse data (CC-BY content)."""

import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from .types import BOOK_CODES, MorphologyEntry
from .utils import OSHB_DIR, log, verse_id

# OSHB book filename mapping (different from BSB codes)
OSHB_BOOK_FILES: dict[str, str] = {
    "GEN": "Gen.xml",
    "EXO": "Exod.xml",
    "LEV": "Lev.xml",
    "NUM": "Num.xml",
    "DEU": "Deut.xml",
    "JOS": "Josh.xml",
    "JDG": "Judg.xml",
    "RUT": "Ruth.xml",
    "1SA": "1Sam.xml",
    "2SA": "2Sam.xml",
    "1KI": "1Kgs.xml",
    "2KI": "2Kgs.xml",
    "1CH": "1Chr.xml",
    "2CH": "2Chr.xml",
    "EZR": "Ezra.xml",
    "NEH": "Neh.xml",
    "EST": "Esth.xml",
    "JOB": "Job.xml",
    "PSA": "Ps.xml",
    "PRO": "Prov.xml",
    "ECC": "Eccl.xml",
    "SNG": "Song.xml",
    "ISA": "Isa.xml",
    "JER": "Jer.xml",
    "LAM": "Lam.xml",
    "EZK": "Ezek.xml",
    "DAN": "Dan.xml",
    "HOS": "Hos.xml",
    "JOL": "Joel.xml",
    "AMO": "Amos.xml",
    "OBA": "Obad.xml",
    "JON": "Jonah.xml",
    "MIC": "Mic.xml",
    "NAM": "Nah.xml",
    "HAB": "Hab.xml",
    "ZEP": "Zeph.xml",
    "HAG": "Hag.xml",
    "ZEC": "Zech.xml",
    "MAL": "Mal.xml",
}

# Morphology code to part of speech mapping
MORPH_POS: dict[str, str] = {
    "A": "adjective",
    "C": "conjunction",
    "D": "adverb",
    "N": "noun",
    "P": "pronoun",
    "R": "preposition",
    "S": "suffix",
    "T": "particle",
    "V": "verb",
}


def parse_morph_code(morph: str) -> str:
    """Extract part of speech from morphology code."""
    if not morph:
        return ""

    # OSHB morphology format: "H[prefix]/[POS][details]"
    # Examples: "HR/Ncfsa", "HVqp3ms", "HC/Vqw3ms"

    # Remove Hebrew prefix marker and any prefix codes
    parts = morph.replace("H", "").split("/")
    main_part = parts[-1] if parts else ""

    if main_part:
        pos_code = main_part[0].upper()
        return MORPH_POS.get(pos_code, pos_code)

    return ""


def load_oshb_morphology() -> dict[str, list[MorphologyEntry]]:
    """
    Load OSHB morphology data for Old Testament.
    Returns a dict mapping verse IDs to lists of morphology entries.
    """
    if not OSHB_DIR.exists():
        log("WARNING: OSHB directory not found")
        return {}

    morphology: dict[str, list[MorphologyEntry]] = {}
    files_processed = 0

    # XML namespace
    ns = {"osis": "http://www.bibletechnologies.net/2003/OSIS/namespace"}

    for book_code, filename in OSHB_BOOK_FILES.items():
        xml_path = OSHB_DIR / filename
        if not xml_path.exists():
            continue

        try:
            tree = ET.parse(xml_path)
            root = tree.getroot()

            # Find all verses
            for verse_elem in root.findall(".//osis:verse", ns):
                # Get verse reference (e.g., "Gen.1.1")
                osis_id = verse_elem.get("osisID", "")
                if not osis_id:
                    continue

                # Parse OSIS ID to our format
                try:
                    parts = osis_id.split(".")
                    chapter = int(parts[1])
                    verse_num = int(parts[2])
                    vid = verse_id(book_code, chapter, verse_num)
                except (IndexError, ValueError):
                    continue

                # Find all words with morphology
                entries: list[MorphologyEntry] = []
                for word_elem in verse_elem.findall(".//osis:w", ns):
                    lemma = word_elem.get("lemma", "")
                    morph = word_elem.get("morph", "")
                    text = word_elem.text or ""

                    if lemma and morph:
                        # Parse lemma to Strong's number
                        # Format: "b/7225", "7225", or "1254 a" -> "H7225", "H1254"
                        # OSHB uses "number + letter" format for some lemmas
                        lemma_parts = lemma.split("/")
                        strongs_num = ""
                        for part in lemma_parts:
                            # Extract numeric portion (handles "1254 a" format)
                            num_match = re.match(r"(\d+)", part)
                            if num_match:
                                strongs_num = f"H{int(num_match.group(1))}"
                                break

                        if strongs_num:
                            entry: MorphologyEntry = {
                                "s": strongs_num,
                                "m": morph,
                                "p": parse_morph_code(morph),
                                "l": text.strip(),
                            }
                            entries.append(entry)

                if entries:
                    morphology[vid] = entries

            files_processed += 1

        except ET.ParseError as e:
            log(f"WARNING: Error parsing {xml_path}: {e}")
            continue

    log(f"Loaded morphology from {files_processed} OSHB files")
    log(f"Verses with morphology: {len(morphology)}")

    return morphology


def enrich_with_morphology(
    verses: list[dict[str, Any]], morphology: dict[str, list[MorphologyEntry]]
) -> list[dict[str, Any]]:
    """Add morphology data to verse data."""
    enriched = []

    for verse in verses:
        vid = verse_id(verse["b"], verse["c"], verse["v"])
        verse_morph = morphology.get(vid, [])

        enriched_verse = {**verse, "m": verse_morph}
        enriched.append(enriched_verse)

    return enriched
