#!/usr/bin/env python3
"""Build proper names data from STEP Bible TIPNR JSON files."""

import json
import re
import sys
from pathlib import Path
from typing import Optional

from .types import BOOK_CODES
from .utils import (
    GEOGRAPHY_DIR,
    PROPER_NAMES_DIR,
    SOURCES_DIR,
    ensure_dir,
    format_file_size,
    log,
    read_json,
    write_json,
    write_jsonl,
)

# Source JSON files (pre-processed from TIPNR-raw.txt)
TIPNR_DIR = SOURCES_DIR / "stepbible-tipnr"
TIPNR_PEOPLE_FILE = TIPNR_DIR / "TIPNR_people.json"
TIPNR_PLACES_FILE = TIPNR_DIR / "TIPNR_places.json"
TIPNR_OTHER_FILE = TIPNR_DIR / "TIPNR_other.json"

# Book abbreviation mapping: TIPNR format -> pipeline format
BOOK_MAP = {
    "Gen": "GEN",
    "Exo": "EXO",
    "Lev": "LEV",
    "Num": "NUM",
    "Deu": "DEU",
    "Jos": "JOS",
    "Jdg": "JDG",
    "Rut": "RUT",
    "1Sa": "1SA",
    "2Sa": "2SA",
    "1Ki": "1KI",
    "2Ki": "2KI",
    "1Ch": "1CH",
    "2Ch": "2CH",
    "Ezr": "EZR",
    "Neh": "NEH",
    "Est": "EST",
    "Job": "JOB",
    "Psa": "PSA",
    "Pro": "PRO",
    "Ecc": "ECC",
    "Sng": "SNG",
    "Sol": "SNG",
    "Isa": "ISA",
    "Jer": "JER",
    "Lam": "LAM",
    "Eze": "EZK",
    "Ezk": "EZK",
    "Dan": "DAN",
    "Hos": "HOS",
    "Joe": "JOL",
    "Amo": "AMO",
    "Oba": "OBA",
    "Jon": "JON",
    "Mic": "MIC",
    "Nam": "NAM",
    "Hab": "HAB",
    "Zep": "ZEP",
    "Hag": "HAG",
    "Zec": "ZEC",
    "Mal": "MAL",
    "Mat": "MAT",
    "Mrk": "MRK",
    "Luk": "LUK",
    "Joh": "JHN",
    "Jhn": "JHN",
    "Act": "ACT",
    "Rom": "ROM",
    "1Co": "1CO",
    "2Co": "2CO",
    "Gal": "GAL",
    "Eph": "EPH",
    "Php": "PHP",
    "Phi": "PHP",
    "Col": "COL",
    "1Th": "1TH",
    "2Th": "2TH",
    "1Ti": "1TI",
    "2Ti": "2TI",
    "Tit": "TIT",
    "Phm": "PHM",
    "Heb": "HEB",
    "Jas": "JAS",
    "Jam": "JAS",
    "1Pe": "1PE",
    "2Pe": "2PE",
    "1Joh": "1JN",
    "2Joh": "2JN",
    "3Joh": "3JN",
    "1Jn": "1JN",
    "2Jn": "2JN",
    "3Jn": "3JN",
    "Jud": "JUD",
    "Rev": "REV",
}

VALID_BOOK_CODES = set(BOOK_CODES.values())


def normalize_verse_ref(ref: str) -> Optional[str]:
    """Normalize a TIPNR verse reference to pipeline format.

    Examples:
        "Exo.4.14" -> "EXO.4.14"
        "1Joh.1.1" -> "1JN.1.1"
        "Exo.7.10a" -> "EXO.7.10"

    Returns None if parsing fails.
    """
    if not ref:
        return None

    ref = ref.strip()

    # Match: BookAbbrev.Chapter.Verse (verse may have letter suffix like "10a")
    match = re.match(r"^(\d?[A-Za-z]+)\.(\d+)\.(\d+)[a-z]?$", ref)
    if not match:
        return None

    book_abbrev, chapter, verse = match.groups()

    book_code = BOOK_MAP.get(book_abbrev)
    if not book_code:
        return None

    if book_code not in VALID_BOOK_CODES:
        return None

    return f"{book_code}.{int(chapter)}.{int(verse)}"


def normalize_verse_refs(refs: list[str]) -> list[str]:
    """Normalize a list of verse references, deduplicating."""
    seen = set()
    result = []
    for ref in refs:
        normalized = normalize_verse_ref(ref)
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


def extract_id(unique_name: str) -> str:
    """Extract a clean ID from uniqueName like 'Aaron@Exo.4.14'.

    Returns e.g. 'Aaron_Exo_4_14'.
    """
    return unique_name.replace("@", "_").replace(".", "_")


def normalize_relation(rel: str) -> Optional[str]:
    """Normalize a relation reference like 'Moses@Exo.2.10' to an ID."""
    if not rel:
        return None
    return extract_id(rel)


def normalize_relations(relations: dict) -> dict:
    """Normalize the relations dict, filtering out empty entries."""
    result = {}

    for key in ("father", "mother"):
        val = relations.get(key, "")
        if val:
            result[key] = normalize_relation(val)

    for key in ("siblings", "partners", "offspring"):
        raw_list = relations.get(key, [])
        normalized = [normalize_relation(r) for r in raw_list if r]
        normalized = [r for r in normalized if r]
        if normalized:
            result[key] = normalized

    return result


def process_names(names_list: list[dict]) -> tuple[list[dict], list[str]]:
    """Process the names array from a TIPNR entry.

    Returns (processed_names, all_verse_refs).
    """
    processed = []
    all_refs = []

    for name_entry in names_list:
        refs = name_entry.get("exhaustiveReferences", [])
        normalized_refs = normalize_verse_refs(refs)
        all_refs.extend(normalized_refs)

        entry = {}

        # Translations
        for field in ("ESV_translation", "NIV_translation", "KJV_translation"):
            val = name_entry.get(field, "")
            if val:
                entry[field] = val

        # Strong's number
        strongs = name_entry.get("extendedStrongs", "")
        if strongs:
            entry["strongs"] = strongs

        # Hebrew/Greek
        hg = name_entry.get("Hebrew_Greek", "")
        if hg:
            entry["hebrew_greek"] = hg

        # Variant translations
        for field in ("OT_Ketiv_translated", "OT_Qere_translated", "NT_Variant_translated"):
            val = name_entry.get(field, "")
            if val:
                entry[field] = val

        if normalized_refs:
            entry["verses"] = normalized_refs

        processed.append(entry)

    # Deduplicate all_refs
    seen = set()
    deduped = []
    for r in all_refs:
        if r not in seen:
            seen.add(r)
            deduped.append(r)

    return processed, deduped


def load_json_bom(path: Path) -> list:
    """Load a JSON file, handling UTF-8 BOM."""
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def load_geography() -> dict[str, dict]:
    """Load geography places for cross-referencing."""
    geo_path = GEOGRAPHY_DIR / "places.json"
    if not geo_path.exists():
        log("  Warning: Geography data not found, skipping coordinate merge")
        return {}
    return read_json(geo_path)


def build_people(data: list[dict]) -> list[dict]:
    """Process people entries."""
    people = []

    for entry in data:
        unique_name = entry.get("uniqueName", "")
        if not unique_name:
            continue

        person = {
            "id": extract_id(unique_name),
            "uniqueName": unique_name,
            "type": "person",
        }

        # Description
        desc = entry.get("description", "")
        if desc:
            person["description"] = desc

        # Relations
        relations = entry.get("relations", {})
        normalized_rels = normalize_relations(relations)
        if normalized_rels:
            person["relations"] = normalized_rels

        # Names and verse references
        names_list = entry.get("names", [])
        processed_names, all_refs = process_names(names_list)
        if processed_names:
            person["names"] = processed_names
        if all_refs:
            person["verses"] = all_refs

        people.append(person)

    return people


def build_places(data: list[dict], geography: dict[str, dict]) -> list[dict]:
    """Process place entries, merging with geography data."""
    places = []

    for entry in data:
        unique_name = entry.get("uniqueName", "")
        if not unique_name:
            continue

        place = {
            "id": extract_id(unique_name),
            "uniqueName": unique_name,
            "type": "place",
        }

        # Description
        desc = entry.get("description", "")
        if desc:
            place["description"] = desc

        # Place name
        placename = entry.get("placename", "")
        if placename:
            place["placename"] = placename

        # Geoposition from TIPNR
        geopos = entry.get("geoposition", "")
        if geopos:
            try:
                parts = geopos.split(",")
                if len(parts) == 2:
                    lat = float(parts[0].strip())
                    lon = float(parts[1].strip())
                    if -90 <= lat <= 90 and -180 <= lon <= 180:
                        place["coordinates"] = {"lat": lat, "lon": lon}
            except ValueError:
                pass

        # Try to merge with geography data if no coordinates yet
        if "coordinates" not in place and placename and geography:
            # Try matching by place name
            geo_key = placename.replace(" ", "_").replace("-", "_")
            geo_entry = geography.get(geo_key)
            if geo_entry and "coordinates" in geo_entry:
                place["coordinates"] = geo_entry["coordinates"]
                place["coordinates_source"] = "openbible-geocoding"

        # Details
        details = entry.get("details", "")
        if details:
            place["details"] = details

        # Names and verse references
        names_list = entry.get("names", [])
        processed_names, all_refs = process_names(names_list)
        if processed_names:
            place["names"] = processed_names
        if all_refs:
            place["verses"] = all_refs

        places.append(place)

    return places


def build_other(data: list[dict]) -> list[dict]:
    """Process other entries (deities, titles, etc.)."""
    others = []

    for entry in data:
        unique_name = entry.get("uniqueName", "")
        if not unique_name:
            continue

        other = {
            "id": extract_id(unique_name),
            "uniqueName": unique_name,
            "type": "other",
        }

        # Description
        desc = entry.get("description", "")
        if desc:
            other["description"] = desc

        # Names and verse references
        names_list = entry.get("names", [])
        processed_names, all_refs = process_names(names_list)
        if processed_names:
            other["names"] = processed_names
        if all_refs:
            other["verses"] = all_refs

        others.append(other)

    return others


def build_proper_names():
    """Build proper names data from TIPNR JSON files."""
    log("Building proper names data...")

    # Check source files
    for src in (TIPNR_PEOPLE_FILE, TIPNR_PLACES_FILE, TIPNR_OTHER_FILE):
        if not src.exists():
            log(f"ERROR: Source file not found: {src}")
            sys.exit(1)

    ensure_dir(PROPER_NAMES_DIR)

    # Load source data
    log("Loading TIPNR JSON files...")
    raw_people = load_json_bom(TIPNR_PEOPLE_FILE)
    raw_places = load_json_bom(TIPNR_PLACES_FILE)
    raw_other = load_json_bom(TIPNR_OTHER_FILE)
    log(f"  People: {len(raw_people):,}, Places: {len(raw_places):,}, Other: {len(raw_other):,}")

    # Load geography for coordinate merging
    geography = load_geography()

    # Process each category
    log("Processing people...")
    people = build_people(raw_people)

    log("Processing places...")
    places = build_places(raw_places, geography)

    log("Processing other entries...")
    others = build_other(raw_other)

    # Write outputs
    log("Writing proper names data...")

    # People
    write_json(PROPER_NAMES_DIR / "people.json", people)
    write_jsonl(PROPER_NAMES_DIR / "people.jsonl", people)

    # Places
    write_json(PROPER_NAMES_DIR / "places.json", places)
    write_jsonl(PROPER_NAMES_DIR / "places.jsonl", places)

    # Other
    write_json(PROPER_NAMES_DIR / "other.json", others)
    write_jsonl(PROPER_NAMES_DIR / "other.jsonl", others)

    # Statistics
    places_with_coords = sum(1 for p in places if "coordinates" in p)
    places_from_geo = sum(1 for p in places if p.get("coordinates_source") == "openbible-geocoding")
    total_people_refs = sum(len(p.get("verses", [])) for p in people)
    total_places_refs = sum(len(p.get("verses", [])) for p in places)
    total_other_refs = sum(len(o.get("verses", [])) for o in others)

    stats = {
        "people_count": len(people),
        "places_count": len(places),
        "other_count": len(others),
        "total_entries": len(people) + len(places) + len(others),
        "places_with_coordinates": places_with_coords,
        "places_coords_from_geography": places_from_geo,
        "total_people_verse_refs": total_people_refs,
        "total_places_verse_refs": total_places_refs,
        "total_other_verse_refs": total_other_refs,
    }

    write_json(PROPER_NAMES_DIR / "stats.json", stats)

    # Calculate output size
    output_size = sum(
        f.stat().st_size
        for f in PROPER_NAMES_DIR.iterdir()
        if f.is_file()
    )

    # Summary
    log("")
    log("=== Proper Names Build Complete ===")
    log(f"People: {len(people):,}")
    log(f"Places: {len(places):,} ({places_with_coords:,} with coordinates, {places_from_geo:,} from geography)")
    log(f"Other: {len(others):,}")
    log(f"Total verse references: {total_people_refs + total_places_refs + total_other_refs:,}")
    log(f"Output: {PROPER_NAMES_DIR}")
    log(f"Output size: {format_file_size(output_size)}")


def main() -> None:
    """Main entry point."""
    build_proper_names()


if __name__ == "__main__":
    main()
