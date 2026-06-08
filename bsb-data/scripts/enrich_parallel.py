"""Extract parallel passage data from UBS Parallel Passages.

This module processes the UBS Parallel Passages XML file to identify
verses that have parallel or quoted text in other parts of Scripture.

Parallel passage format:
- Each <Passage> contains multiple <Verse> elements
- Verses include HEB or GRK attributes with word-level alignment codes:
  - 0: No match
  - 1: Partial match
  - 2: Full match
  - 3-5: Various alignment levels

This enables linking parallel accounts (e.g., Kings/Chronicles, Synoptic Gospels)
and OT quotations in NT.

License: CC-BY-SA 4.0 (United Bible Societies)
"""

import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from .utils import SOURCES_DIR, log

UBS_DIR = SOURCES_DIR / "ubs-dictionaries"

# Regex to parse verse references like "GEN 1:27" or "MAT 19:4-5"
VERSE_REF_PATTERN = re.compile(r"^([A-Z0-9]+)\s+(\d+):(\d+)(?:-(\d+))?$")


def parse_verse_ref(ref: str) -> list[tuple[str, int, int]]:
    """
    Parse verse reference to list of (book_code, chapter, verse) tuples.

    Handles both single verses ("GEN 1:1") and ranges ("GEN 1:1-3").
    Returns empty list if parsing fails.
    """
    match = VERSE_REF_PATTERN.match(ref.strip())
    if not match:
        return []

    book = match.group(1)
    chapter = int(match.group(2))
    start_verse = int(match.group(3))
    end_verse = int(match.group(4)) if match.group(4) else start_verse

    return [(book, chapter, v) for v in range(start_verse, end_verse + 1)]


def build_parallel_index() -> dict[str, list[dict[str, Any]]]:
    """
    Build an index mapping verse IDs to their parallel passages.

    Returns dict: {
        "GEN.1.27": [
            {"ref": "GEN.5.2", "type": "HEB"},
            {"ref": "MAT.19.4", "type": "GRK"},
        ]
    }
    """
    parallel_index: dict[str, list[dict[str, Any]]] = {}

    xml_path = UBS_DIR / "ParallelPassages.xml"
    if not xml_path.exists():
        log(f"WARNING: Parallel Passages not found at {xml_path}")
        log("  Run: bash scripts/fetch-sources.sh")
        return parallel_index

    log(f"Loading parallel passages from {xml_path.name}")

    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except ET.ParseError as e:
        log(f"WARNING: Failed to parse Parallel Passages XML: {e}")
        return parallel_index

    passages_count = 0

    for passage in root.findall("Passage"):
        verses = passage.findall("Verse")
        if len(verses) < 2:
            continue

        passages_count += 1

        # Collect all verse refs in this passage group
        verse_refs: list[tuple[str, str]] = []  # (verse_id, type)

        for verse_elem in verses:
            ref_text = verse_elem.text
            if not ref_text:
                continue

            # Determine type (Hebrew or Greek)
            verse_type = "HEB" if verse_elem.get("HEB") else "GRK"

            # Parse the reference
            parsed = parse_verse_ref(ref_text)
            for book, chapter, verse in parsed:
                verse_id = f"{book}.{chapter}.{verse}"
                verse_refs.append((verse_id, verse_type))

        # Create cross-references between all verses in the passage
        for i, (verse_id, _) in enumerate(verse_refs):
            if verse_id not in parallel_index:
                parallel_index[verse_id] = []

            for j, (other_id, other_type) in enumerate(verse_refs):
                if i != j:
                    # Check if this parallel is already recorded
                    existing = [p for p in parallel_index[verse_id] if p["ref"] == other_id]
                    if not existing:
                        parallel_index[verse_id].append(
                            {
                                "ref": other_id,
                                "type": other_type,
                            }
                        )

    log(f"  Processed {passages_count} parallel passage groups")
    log(f"  Verses with parallel refs: {len(parallel_index)}")

    # Count unique parallel relationships
    total_links = sum(len(v) for v in parallel_index.values())
    log(f"  Total parallel links: {total_links}")

    return parallel_index


def enrich_with_parallels(
    verses: list[dict[str, Any]],
    parallel_index: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    """
    Add parallel passage references to verses.

    Adds 'par' field to each verse that has parallel passages:
    {
        "par": [
            {"ref": "GEN.5.2", "type": "HEB"},
            {"ref": "MAT.19.4", "type": "GRK"}
        ]
    }
    """
    enriched = []
    enriched_count = 0

    for verse in verses:
        verse_id = verse.get("id")
        enriched_verse = {**verse}

        if verse_id and verse_id in parallel_index:
            parallels = parallel_index[verse_id]
            if parallels:
                # Simplify to just reference list for compact output
                enriched_verse["par"] = [p["ref"] for p in parallels]
                enriched_count += 1

        enriched.append(enriched_verse)

    log(f"  Added parallel refs to {enriched_count} verses")
    return enriched
