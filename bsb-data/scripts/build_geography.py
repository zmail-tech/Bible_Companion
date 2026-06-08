#!/usr/bin/env python3
"""Build geography data from OpenBible geocoding.

Supports two source formats:
- ancient.jsonl + modern.jsonl (new, preferred)
- places.txt TSV (legacy fallback)
"""

import csv
import re
import sys
from collections import defaultdict
from typing import Optional

from .types import BOOK_CODES
from .utils import (
    ANCIENT_PLACES_FILE,
    GEOCODING_FILE,
    GEOGRAPHY_DIR,
    MODERN_PLACES_FILE,
    ensure_dir,
    format_file_size,
    log,
    read_jsonl,
    write_json,
    write_jsonl,
)

VALID_BOOK_CODES = set(BOOK_CODES.values())


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def strip_html(text: str) -> str:
    """Remove HTML/XML tags from text."""
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text).strip()


# ---------------------------------------------------------------------------
# New JSONL-based builder (ancient.jsonl + modern.jsonl)
# ---------------------------------------------------------------------------

def usx_to_verse_id(usx: str) -> Optional[str]:
    """Convert USX verse ref to pipeline format.

    "2KI 5:12" -> "2KI.5.12"
    Returns None if book code is not in our 66-book canon.
    """
    if not usx:
        return None
    # USX format: "BOOK CH:VS"
    parts = usx.strip().split(" ")
    if len(parts) != 2:
        return None
    book = parts[0]
    if book not in VALID_BOOK_CODES:
        return None
    cv = parts[1].replace(":", ".")
    return f"{book}.{cv}"


def parse_lonlat(lonlat: str) -> Optional[dict]:
    """Parse 'lon,lat' string to coordinates dict.

    Note: OpenBible uses lon,lat order (longitude first).
    """
    if not lonlat:
        return None
    try:
        parts = lonlat.split(",")
        if len(parts) != 2:
            return None
        lon_val = float(parts[0].strip())
        lat_val = float(parts[1].strip())
        if -90 <= lat_val <= 90 and -180 <= lon_val <= 180:
            return {"lat": lat_val, "lon": lon_val, "precision": "exact"}
    except ValueError:
        pass
    return None


def load_modern_places() -> dict[str, dict]:
    """Load modern.jsonl into a lookup dict keyed by id."""
    if not MODERN_PLACES_FILE.exists():
        return {}

    modern = {}
    for entry in read_jsonl(MODERN_PLACES_FILE):
        mid = entry.get("id", "")
        if not mid:
            continue
        modern[mid] = {
            "id": mid,
            "name": entry.get("friendly_id", ""),
            "type": entry.get("type", ""),
            "lonlat": entry.get("lonlat", ""),
            "url_slug": entry.get("url_slug", ""),
        }
    return modern


def extract_best_identification(identifications: list, modern_index: dict) -> dict:
    """Extract coordinates, type, and modern link from the best identification."""
    result: dict = {}

    if not identifications:
        return result

    best = identifications[0]
    resolutions = best.get("resolutions", [])

    if not resolutions:
        return result

    res = resolutions[0]

    # Coordinates
    coords = parse_lonlat(res.get("lonlat", ""))
    if coords:
        result["coordinates"] = coords

    # Place type from resolution
    place_type = res.get("type", "")
    if place_type:
        result["place_type"] = place_type

    # Modern place link
    modern_id = res.get("modern_basis_id", "")
    if modern_id:
        result["modern_place_id"] = modern_id
        modern_entry = modern_index.get(modern_id)
        if modern_entry:
            result["modern_place_name"] = modern_entry.get("name", "")

    # Confidence score
    score = best.get("score", {})
    if isinstance(score, dict) and "time_total" in score:
        result["confidence_score"] = score["time_total"]

    return result


def extract_name_variants(name_counts: dict) -> list[dict]:
    """Convert translation_name_counts to sorted variant list."""
    if not name_counts:
        return []
    return sorted(
        [{"name": name, "count": count} for name, count in name_counts.items()],
        key=lambda x: -x["count"],
    )


def extract_tipnr_id(linked_data: dict) -> Optional[str]:
    """Extract TIPNR cross-reference ID from linked_data.

    The key 's3b25cf' contains TIPNR IDs like 'Jerusalem@Jos.10.1'.
    Convert to the ID format used by build_proper_names.py.
    """
    tipnr = linked_data.get("s3b25cf", {})
    tipnr_id = tipnr.get("id")
    if tipnr_id and isinstance(tipnr_id, str):
        return tipnr_id.replace("@", "_").replace(".", "_")
    return None


def extract_wikidata_id(linked_data: dict) -> Optional[str]:
    """Extract Wikidata ID (e.g. 'Q1218' for Jerusalem)."""
    wd = linked_data.get("s7cc8b2", {})
    wid = wd.get("id", "")
    if wid and isinstance(wid, str) and wid.startswith("Q"):
        return wid
    return None


def build_geography_from_jsonl() -> dict[str, dict]:
    """Build geography data from ancient.jsonl + modern.jsonl."""
    log("  Source: ancient.jsonl + modern.jsonl")

    # Load modern places index
    modern_index = load_modern_places()
    log(f"  Loaded {len(modern_index):,} modern places")

    # Read ancient places
    ancient_entries = read_jsonl(ANCIENT_PLACES_FILE)
    log(f"  Loaded {len(ancient_entries):,} ancient places")

    places = {}
    skipped = 0

    for entry in ancient_entries:
        friendly_id = entry.get("friendly_id", "")
        if not friendly_id:
            skipped += 1
            continue

        place_id = friendly_id.replace(" ", "_").replace("-", "_")

        # Base fields (backward compatible)
        place_data: dict = {
            "id": place_id,
            "name": friendly_id,
            "type": "place",
        }

        # Coordinates from best identification
        best = extract_best_identification(
            entry.get("identifications", []), modern_index
        )
        if best.get("coordinates"):
            place_data["coordinates"] = best["coordinates"]

        # Verse references
        verses = []
        for v in entry.get("verses", []):
            vid = usx_to_verse_id(v.get("usx", ""))
            if vid:
                verses.append(vid)
        if verses:
            place_data["verses"] = verses

        # Comment
        comment = strip_html(entry.get("comment", ""))
        if comment:
            place_data["comment"] = comment

        # Place types (new)
        types = entry.get("types", [])
        if types:
            place_data["place_types"] = types

        # Name variants across translations (new)
        name_counts = entry.get("translation_name_counts", {})
        if name_counts:
            place_data["name_variants"] = extract_name_variants(name_counts)

        # Modern place link (new)
        if best.get("modern_place_id"):
            modern_link: dict = {"id": best["modern_place_id"]}
            if best.get("modern_place_name"):
                modern_link["name"] = best["modern_place_name"]
            place_data["modern_place"] = modern_link

        # TIPNR cross-reference (new)
        linked_data = entry.get("linked_data", {})
        tipnr_id = extract_tipnr_id(linked_data)
        if tipnr_id:
            place_data["tipnr_id"] = tipnr_id

        # Wikidata ID (new)
        wikidata_id = extract_wikidata_id(linked_data)
        if wikidata_id:
            place_data["wikidata_id"] = wikidata_id

        # Confidence score (new)
        if best.get("confidence_score") is not None:
            place_data["confidence_score"] = best["confidence_score"]

        # URL slug (new)
        url_slug = entry.get("url_slug", "")
        if url_slug:
            place_data["url_slug"] = url_slug

        # Source ID for linking back to OpenBible (new)
        source_id = entry.get("id", "")
        if source_id:
            place_data["source_id"] = source_id

        places[place_id] = place_data

    log(f"  Processed: {len(places):,}, Skipped: {skipped:,}")
    return places


# ---------------------------------------------------------------------------
# Legacy TSV-based builder (places.txt)
# ---------------------------------------------------------------------------

def normalize_verse_ref(ref: str) -> Optional[str]:
    """Normalize verse reference from geocoding TSV format to pipeline format."""
    if not ref:
        return None
    ref = ref.strip()
    match = re.match(r"^(\d?\s?[A-Za-z]+)\s+(\d+):(\d+)$", ref)
    if not match:
        return None
    book, chapter, verse = match.groups()
    book = book.replace(" ", "")
    book_map = {
        "Gen": "GEN", "Exo": "EXO", "Lev": "LEV", "Num": "NUM", "Deu": "DEU",
        "Jos": "JOS", "Jdg": "JDG", "Rut": "RUT", "1Sa": "1SA", "2Sa": "2SA",
        "1Ki": "1KI", "2Ki": "2KI", "1Ch": "1CH", "2Ch": "2CH", "Ezr": "EZR",
        "Neh": "NEH", "Est": "EST", "Job": "JOB", "Psa": "PSA", "Pro": "PRO",
        "Ecc": "ECC", "Sng": "SNG", "Isa": "ISA", "Jer": "JER", "Lam": "LAM",
        "Eze": "EZK", "Dan": "DAN", "Hos": "HOS", "Joe": "JOL", "Amo": "AMO",
        "Oba": "OBA", "Jon": "JON", "Mic": "MIC", "Nam": "NAM", "Hab": "HAB",
        "Zep": "ZEP", "Hag": "HAG", "Zec": "ZEC", "Mal": "MAL", "Mat": "MAT",
        "Mrk": "MRK", "Luk": "LUK", "Joh": "JHN", "Act": "ACT", "Rom": "ROM",
        "1Co": "1CO", "2Co": "2CO", "Gal": "GAL", "Eph": "EPH", "Php": "PHP",
        "Col": "COL", "1Th": "1TH", "2Th": "2TH", "1Ti": "1TI", "2Ti": "2TI",
        "Tit": "TIT", "Phm": "PHM", "Heb": "HEB", "Jas": "JAS", "1Pe": "1PE",
        "2Pe": "2PE", "1Joh": "1JN", "2Joh": "2JN", "3Joh": "3JN", "Jud": "JUD",
        "Rev": "REV", "Kgs": "KI", "Chr": "CH", "Cor": "CO", "Thess": "TH",
        "Tim": "TI", "Pet": "PE", "Jhn": "JHN",
    }
    book_code = book_map.get(book, book.upper())
    if book_code not in VALID_BOOK_CODES:
        return None
    try:
        return f"{book_code}.{int(chapter)}.{int(verse)}"
    except ValueError:
        return None


def build_geography_from_tsv() -> dict[str, dict]:
    """Build geography data from legacy places.txt TSV."""
    log("  Source: places.txt (legacy TSV)")

    places = {}
    total_rows = 0
    processed = 0
    skipped = 0

    with open(GEOCODING_FILE, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            total_rows += 1
            esv_name = (row.get("ESV Name") or "").strip()
            if not esv_name:
                skipped += 1
                continue

            lat = (row.get("Lat") or "").strip()
            lon = (row.get("Lon") or "").strip()
            coords = None
            if lat and lon and lat != "?" and lon != "?":
                try:
                    lat_clean = lat.replace("~", "").replace(">", "").replace("<", "")
                    lon_clean = lon.replace("~", "").replace(">", "").replace("<", "")
                    lat_val = float(lat_clean)
                    lon_val = float(lon_clean)
                    if -90 <= lat_val <= 90 and -180 <= lon_val <= 180:
                        coords = {
                            "lat": lat_val,
                            "lon": lon_val,
                            "precision": "approximate" if "~" in lat or "~" in lon else "exact",
                        }
                except ValueError:
                    pass

            passages_str = (row.get("Passages") or "").strip()
            verses = []
            if passages_str:
                for ref in passages_str.split(","):
                    normalized = normalize_verse_ref(ref.strip())
                    if normalized:
                        verses.append(normalized)

            comment = (row.get("Comment") or "").strip()
            place_id = esv_name.replace(" ", "_").replace("-", "_")

            place_data: dict = {
                "id": place_id,
                "name": esv_name,
                "type": "place",
            }
            if coords:
                place_data["coordinates"] = coords
            if verses:
                place_data["verses"] = verses
            if comment:
                place_data["comment"] = comment

            kmz_name = (row.get("KMZ Name") or "").strip()
            if kmz_name and kmz_name != esv_name:
                place_data["alternative_name"] = kmz_name

            places[place_id] = place_data
            processed += 1

    log(f"  Total rows: {total_rows:,}")
    log(f"  Processed: {processed:,}, Skipped: {skipped:,}")
    return places


# ---------------------------------------------------------------------------
# Main build function
# ---------------------------------------------------------------------------

def build_geography() -> dict[str, dict]:
    """Build geography data from OpenBible geocoding.

    Prefers ancient.jsonl (new format), falls back to places.txt (legacy).
    """
    log("Building geography data...")

    # Choose source
    if ANCIENT_PLACES_FILE.exists():
        places = build_geography_from_jsonl()
    elif GEOCODING_FILE.exists():
        places = build_geography_from_tsv()
    else:
        log("ERROR: No geocoding source found.")
        log(f"  Expected: {ANCIENT_PLACES_FILE}")
        log(f"  Or:       {GEOCODING_FILE}")
        log("  Run: bash scripts/fetch-sources.sh")
        sys.exit(1)

    ensure_dir(GEOGRAPHY_DIR)

    # Write outputs
    log("  Writing geography data...")

    output_path = GEOGRAPHY_DIR / "places.json"
    write_json(output_path, places)

    jsonl_path = GEOGRAPHY_DIR / "places.jsonl"
    write_jsonl(jsonl_path, list(places.values()))

    # Statistics
    total_places = len(places)
    with_coords = sum(1 for p in places.values() if "coordinates" in p)
    with_verses = sum(1 for p in places.values() if "verses" in p)
    total_verses = sum(len(p.get("verses", [])) for p in places.values())
    with_types = sum(1 for p in places.values() if "place_types" in p)
    with_tipnr = sum(1 for p in places.values() if "tipnr_id" in p)
    with_modern = sum(1 for p in places.values() if "modern_place" in p)
    with_variants = sum(1 for p in places.values() if "name_variants" in p)
    with_wikidata = sum(1 for p in places.values() if "wikidata_id" in p)

    # Place type breakdown
    type_counts: dict[str, int] = defaultdict(int)
    for p in places.values():
        for t in p.get("place_types", []):
            type_counts[t] += 1

    source_format = "ancient.jsonl" if ANCIENT_PLACES_FILE.exists() else "places.txt"

    stats: dict = {
        "source_format": source_format,
        "total_places": total_places,
        "with_coordinates": with_coords,
        "with_verses": with_verses,
        "total_verse_references": total_verses,
        "avg_verses_per_place": round(total_verses / total_places, 2) if total_places else 0,
    }

    if with_types:
        stats["with_place_types"] = with_types
        stats["place_type_counts"] = dict(sorted(type_counts.items(), key=lambda x: -x[1]))
    if with_tipnr:
        stats["with_tipnr_link"] = with_tipnr
    if with_modern:
        stats["with_modern_link"] = with_modern
    if with_variants:
        stats["with_name_variants"] = with_variants
    if with_wikidata:
        stats["with_wikidata_link"] = with_wikidata

    write_json(GEOGRAPHY_DIR / "stats.json", stats)

    # Output size
    output_size = sum(
        f.stat().st_size for f in GEOGRAPHY_DIR.iterdir() if f.is_file()
    )

    # Summary
    log("")
    log("=== Geography Build Complete ===")
    log(f"Source: {source_format}")
    log(f"Total places: {total_places:,}")
    log(f"  With coordinates: {with_coords:,}")
    log(f"  With verse references: {with_verses:,}")
    log(f"  With place types: {with_types:,}")
    log(f"  With TIPNR link: {with_tipnr:,}")
    log(f"  With modern place: {with_modern:,}")
    log(f"  With Wikidata ID: {with_wikidata:,}")
    log(f"Total verse references: {total_verses:,}")
    log(f"Output: {GEOGRAPHY_DIR}")
    log(f"Output size: {format_file_size(output_size)}")

    return places


def main() -> None:
    """Main entry point."""
    build_geography()


if __name__ == "__main__":
    main()
