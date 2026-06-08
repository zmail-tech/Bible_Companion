"""Shared utility functions for BSB Data processing."""

import json
import re
from datetime import datetime
from pathlib import Path

from .types import BOOK_CODES, BOOK_NUMBERS

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
SOURCES_DIR = PROJECT_ROOT / "sources"
OUTPUT_DIR = PROJECT_ROOT / "output"
USJ_DIR = SOURCES_DIR / "bsb-usj" / "results_usj" / "strongs_full"
USJ_PLAIN_DIR = SOURCES_DIR / "bsb-usj" / "results_usj" / "plain"
BIBLE_DB_DIR = SOURCES_DIR / "bible-databases"
OSHB_DIR = SOURCES_DIR / "oshb" / "wlc"
BSB_TABLES_FILE = SOURCES_DIR / "bsb-tables" / "bsb_tables.tsv"
BSB_CONCORDANCE_FILE = SOURCES_DIR / "bsb_concordance" / "bsb_concordance.csv"
STEPBIBLE_TIPNR_FILE = SOURCES_DIR / "stepbible-tipnr" / "TIPNR-raw.txt"
GEOCODING_FILE = SOURCES_DIR / "openbible-geocoding" / "places.txt"
ANCIENT_PLACES_FILE = SOURCES_DIR / "openbible-geocoding" / "ancient.jsonl"
MODERN_PLACES_FILE = SOURCES_DIR / "openbible-geocoding" / "modern.jsonl"
STRONGS_DIR = SOURCES_DIR / "openscriptures-strongs"
NAVES_DIR = SOURCES_DIR / "ccel-naves"
UBS_DIR = SOURCES_DIR / "ubs-dictionaries"
MARBLE_DIR = UBS_DIR / "marble"
VERSIFICATION_DIR_SRC = SOURCES_DIR / "versification"

# Output directories (under base/ for downstream extensibility)
BASE_DIR = OUTPUT_DIR / "base"
DISPLAY_DIR = BASE_DIR / "display"
GREEK_TSV_DIR = BASE_DIR / "greek-tsv"
HEBREW_TSV_DIR = BASE_DIR / "hebrew-tsv"
INDEX_CC_BY_SPLIT_DIR = BASE_DIR / "index-cc-by"
CONCORDANCE_DIR = BASE_DIR / "concordance"
ENGLISH_CONCORDANCE_DIR = BASE_DIR / "english-concordance"
PROPER_NAMES_DIR = BASE_DIR / "proper-names"
GEOGRAPHY_DIR = BASE_DIR / "geography"
VERSIFICATION_DIR = BASE_DIR / "versification"
LEXICON_DIR = BASE_DIR / "lexicon"
SCHEMA_DIR = OUTPUT_DIR / "schema"

# Vector DB output directories (sibling to base/)
VECTOR_DB_DIR = OUTPUT_DIR / "vector-db"
INDEX_PD_DIR = VECTOR_DB_DIR / "index-pd"
INDEX_CC_BY_DIR = VECTOR_DB_DIR / "index-cc-by"


def ensure_dir(path: Path) -> None:
    """Ensure a directory exists, creating it if necessary."""
    path.mkdir(parents=True, exist_ok=True)


def read_json(path: Path) -> dict | list:
    """Read a JSON file."""
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: dict | list, compact: bool = False) -> None:
    """Write JSON to file."""
    ensure_dir(path.parent)
    with open(path, "w", encoding="utf-8") as f:
        if compact:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(data, f, indent=2, ensure_ascii=False)


def write_jsonl(path: Path, items: list, compact: bool = True) -> None:
    """Write JSONL (JSON Lines) to file."""
    ensure_dir(path.parent)
    with open(path, "w", encoding="utf-8") as f:
        for item in items:
            if compact:
                f.write(json.dumps(item, ensure_ascii=False, separators=(",", ":")) + "\n")
            else:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")


def read_jsonl(path: Path) -> list:
    """Read JSONL file."""
    items = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                items.append(json.loads(line))
    return items


def book_number_to_code(num: int) -> str:
    """Convert book number to book code."""
    code = BOOK_CODES.get(num)
    if not code:
        raise ValueError(f"Invalid book number: {num}")
    return code


def book_code_to_number(code: str) -> int:
    """Convert book code to book number."""
    num = BOOK_NUMBERS.get(code)
    if num is None:
        raise ValueError(f"Invalid book code: {code}")
    return num


def verse_id(book: str, chapter: int, verse: int) -> str:
    """Create verse ID from components."""
    return f"{book}.{chapter}.{verse}"


def parse_verse_id(vid: str) -> tuple[str, int, int]:
    """Parse verse ID to components."""
    parts = vid.split(".")
    if len(parts) != 3:
        raise ValueError(f"Invalid verse ID: {vid}")
    return parts[0], int(parts[1]), int(parts[2])


def is_valid_strongs(strongs: str) -> bool:
    """Validate a Strong's number format."""
    return bool(re.match(r"^[HG]\d{1,4}[a-z]?$", strongs, re.IGNORECASE))


def normalize_strongs(strongs: str) -> str:
    """Normalize Strong's number (uppercase, remove leading zeros)."""
    match = re.match(r"^([HG])(\d+)([a-z]?)$", strongs, re.IGNORECASE)
    if not match:
        return strongs
    prefix, num, suffix = match.groups()
    return f"{prefix.upper()}{int(num)}{suffix.lower()}"


def extract_strongs_from_words(words: list[tuple[str, str | None]]) -> list[str]:
    """Extract all Strong's numbers from a verse's word pairs."""
    strongs_list: list[str] = []
    for _, s in words:
        if s:
            # Handle multiple strongs separated by /
            for part in s.split("/"):
                normalized = normalize_strongs(part.strip())
                if is_valid_strongs(normalized) and normalized not in strongs_list:
                    strongs_list.append(normalized)
    return strongs_list


def words_to_plain_text(words: list[tuple[str, str | None]]) -> str:
    """Get plain text from word pairs."""
    return "".join(text for text, _ in words).strip()


def log(message: str) -> None:
    """Log with timestamp."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")


def log_book_progress(current: int, total: int, book_code: str) -> None:
    """Log progress for book processing."""
    log(f"Processing {book_code} ({current}/{total})")


def check_sources_exist() -> tuple[bool, list[str]]:
    """Check if source data exists."""
    missing = []

    if not USJ_DIR.exists():
        missing.append("BSB-USJ data (run: bash scripts/fetch-sources.sh)")

    # Check for cross-references (sparse checkout path or full clone path)
    xref_path_sparse = BIBLE_DB_DIR / "sources" / "extras"
    xref_path_full = BIBLE_DB_DIR / "json"
    if not xref_path_sparse.exists() and not xref_path_full.exists():
        missing.append("Bible databases (run: bash scripts/fetch-sources.sh)")

    return len(missing) == 0, missing


def check_oshb_exists() -> bool:
    """Check if OSHB (CC-BY) data exists."""
    return OSHB_DIR.exists()


def format_file_size(size_bytes: int) -> str:
    """Format file size in human-readable format."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes / (1024 * 1024):.2f} MB"
