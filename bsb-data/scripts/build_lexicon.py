#!/usr/bin/env python3
"""Build extended Strong's lexicon data from STEPBible TBESH/TBESG JSON files."""

import re
import sys

from .utils import (
    BASE_DIR,
    SOURCES_DIR,
    ensure_dir,
    format_file_size,
    log,
    read_json,
    write_json,
    write_jsonl,
)

# Source files (extracted from @metaxia/scriptures-source-stepbible-lexicon npm package)
LEXICON_SRC_DIR = SOURCES_DIR / "stepbible-lexicon"
TBESH_FILE = LEXICON_SRC_DIR / "stepbible-tbesh.json"
TBESG_FILE = LEXICON_SRC_DIR / "stepbible-tbesg.json"

# Output directory
LEXICON_DIR = BASE_DIR / "lexicon"


def clean_definition(definition: str) -> str:
    """Clean HTML formatting from definition text.

    Converts <br>, <BR> to newlines and strips remaining HTML tags.
    Preserves the text content.
    """
    if not definition:
        return ""

    # Normalize BR tags to newlines
    text = re.sub(r"<[Bb][Rr]\s*/?>", "\n", definition)

    # Remove bold/italic tags but keep content
    text = re.sub(r"</?[biBI]>", "", text)

    # Remove remaining HTML tags
    text = re.sub(r"<[^>]+>", "", text)

    # Clean up whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()

    return text


def extract_short_gloss(definition: str, gloss: str) -> str:
    """Extract or clean the short gloss.

    The gloss field is already a brief meaning, just clean it up.
    """
    if gloss:
        return gloss.strip()

    # Fallback: try to extract first meaning from definition
    if definition:
        # Take text before first <br> or newline
        first_line = re.split(r"<[Bb][Rr]|[\n]", definition)[0]
        first_line = re.sub(r"<[^>]+>", "", first_line).strip()
        if first_line and len(first_line) < 100:
            return first_line

    return ""


def process_lexicon(data: dict, language: str) -> list[dict]:
    """Process a lexicon dict (keyed by Strong's number) into output entries."""
    entries = []

    for strongs_num, entry in data.items():
        if not isinstance(entry, dict):
            continue

        processed = {
            "strongs": strongs_num,
            "language": language,
        }

        # Extended/disambiguated Strong's numbers
        ext = entry.get("strongsExtended", "")
        if ext and ext != strongs_num:
            processed["strongsExtended"] = ext

        disamb = entry.get("strongsDisambiguated", "")
        if disamb and disamb != strongs_num:
            processed["strongsDisambiguated"] = disamb

        # Lemma (original language word form)
        lemma = entry.get("lemma", "")
        if lemma:
            processed["lemma"] = lemma

        # Transliteration
        xlit = entry.get("transliteration", "")
        if xlit:
            processed["transliteration"] = xlit

        # Morphology code
        morph = entry.get("morphology", "")
        if morph:
            processed["morphology"] = morph

        # Short gloss
        gloss = extract_short_gloss(
            entry.get("definition", ""),
            entry.get("gloss", ""),
        )
        if gloss:
            processed["gloss"] = gloss

        # Full definition (cleaned)
        definition = clean_definition(entry.get("definition", ""))
        if definition:
            processed["definition"] = definition

        entries.append(processed)

    return entries


def build_lexicon():
    """Build extended Strong's lexicon data from STEPBible JSON files."""
    log("Building extended lexicon data...")

    # Check source files
    missing = []
    if not TBESH_FILE.exists():
        missing.append(str(TBESH_FILE))
    if not TBESG_FILE.exists():
        missing.append(str(TBESG_FILE))

    if missing:
        log("ERROR: Lexicon source files not found:")
        for m in missing:
            log(f"  {m}")
        log("")
        log("To download, run:")
        log("  npm pack @metaxia/scriptures-source-stepbible-lexicon")
        log("  tar xzf metaxia-scriptures-source-stepbible-lexicon-*.tgz")
        log("  cp package/data/stepbible-tbe*.json sources/stepbible-lexicon/")
        log("  rm -rf package metaxia-scriptures-source-stepbible-lexicon-*.tgz")
        sys.exit(1)

    ensure_dir(LEXICON_DIR)

    # Load and process Hebrew lexicon
    log("  Loading Hebrew lexicon (TBESH)...")
    hebrew_raw = read_json(TBESH_FILE)
    hebrew_entries = process_lexicon(hebrew_raw, "hebrew")
    log(f"    {len(hebrew_entries):,} entries")

    # Load and process Greek lexicon
    log("  Loading Greek lexicon (TBESG)...")
    greek_raw = read_json(TBESG_FILE)
    greek_entries = process_lexicon(greek_raw, "greek")
    log(f"    {len(greek_entries):,} entries")

    # Write outputs
    log("  Writing lexicon data...")

    # Hebrew
    hebrew_dict = {e["strongs"]: e for e in hebrew_entries}
    write_json(LEXICON_DIR / "hebrew.json", hebrew_dict)
    write_jsonl(LEXICON_DIR / "hebrew.jsonl", hebrew_entries)

    # Greek
    greek_dict = {e["strongs"]: e for e in greek_entries}
    write_json(LEXICON_DIR / "greek.json", greek_dict)
    write_jsonl(LEXICON_DIR / "greek.jsonl", greek_entries)

    # Combined lookup (both languages, keyed by Strong's number)
    combined = {}
    combined.update(hebrew_dict)
    combined.update(greek_dict)
    write_json(LEXICON_DIR / "combined.json", combined)

    # Also write with non-padded keys (H1 instead of H0001) for compatibility
    # with concordance and other pipeline outputs
    combined_compat = {}
    for key, entry in combined.items():
        match = re.match(r"^([HG])0*(\d+)$", key)
        if match:
            short_key = f"{match.group(1)}{match.group(2)}"
            combined_compat[short_key] = entry
        else:
            combined_compat[key] = entry
    write_json(LEXICON_DIR / "combined_compat.json", combined_compat)

    # Gloss-only lookup (lightweight, for quick display) — uses both key formats
    gloss_lookup = {}
    for entry in hebrew_entries + greek_entries:
        if "gloss" in entry:
            val = {
                "gloss": entry["gloss"],
                "lemma": entry.get("lemma", ""),
                "transliteration": entry.get("transliteration", ""),
            }
            # Padded key (H0001)
            gloss_lookup[entry["strongs"]] = val
            # Non-padded key (H1)
            match = re.match(r"^([HG])0*(\d+)$", entry["strongs"])
            if match:
                gloss_lookup[f"{match.group(1)}{match.group(2)}"] = val
    write_json(LEXICON_DIR / "glosses.json", gloss_lookup)

    # Stats
    hebrew_with_def = sum(1 for e in hebrew_entries if "definition" in e)
    greek_with_def = sum(1 for e in greek_entries if "definition" in e)
    hebrew_with_gloss = sum(1 for e in hebrew_entries if "gloss" in e)
    greek_with_gloss = sum(1 for e in greek_entries if "gloss" in e)

    stats = {
        "hebrew_entries": len(hebrew_entries),
        "greek_entries": len(greek_entries),
        "total_entries": len(hebrew_entries) + len(greek_entries),
        "hebrew_with_definition": hebrew_with_def,
        "greek_with_definition": greek_with_def,
        "hebrew_with_gloss": hebrew_with_gloss,
        "greek_with_gloss": greek_with_gloss,
    }
    write_json(LEXICON_DIR / "stats.json", stats)

    # Output size
    output_size = sum(
        f.stat().st_size
        for f in LEXICON_DIR.iterdir()
        if f.is_file()
    )

    # Summary
    log("")
    log("=== Lexicon Build Complete ===")
    log(f"  Hebrew: {len(hebrew_entries):,} entries ({hebrew_with_def:,} with definitions)")
    log(f"  Greek:  {len(greek_entries):,} entries ({greek_with_def:,} with definitions)")
    log(f"  Total:  {len(combined):,} entries")
    log(f"  Output: {LEXICON_DIR}")
    log(f"  Output size: {format_file_size(output_size)}")


def main() -> None:
    """Main entry point."""
    build_lexicon()


if __name__ == "__main__":
    main()
