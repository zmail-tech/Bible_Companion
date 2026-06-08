#!/usr/bin/env python3
"""Build a slim original-language export from bsb_tables.tsv.

Filters rows by language (Hebrew or Greek) and keeps only the columns needed
for downstream chunk-based exports: per-row source text, Strong's, English BSB
gloss, trailing punctuation, plus book/chapter/verse indexing derived from
VerseId. Used by the thin `build_greek_tsv` and `build_hebrew_tsv` modules.
"""

import csv
import sys
from dataclasses import dataclass
from pathlib import Path

from .build_display import parse_verse_id
from .types import BuildStats
from .utils import (
    BSB_TABLES_FILE,
    GREEK_TSV_DIR,
    HEBREW_TSV_DIR,
    ensure_dir,
    format_file_size,
    log,
    write_json,
)

# Source TSV columns (0-indexed)
COL_HEB_SORT = 0
COL_GREEK_SORT = 1
COL_LANGUAGE = 4
COL_SOURCE = 5  # WLC / Nestle Base — Hebrew or Greek surface form
COL_STR_HEB = 10
COL_STR_GRK = 11
COL_VERSE_ID = 12
COL_BSB = 18
COL_PNC = 19


@dataclass(frozen=True)
class LangConfig:
    name: str  # "Greek" or "Hebrew" (matches TSV Language column)
    surface_header: str  # output column name for the source word
    sort_col: int  # 0-indexed TSV column for the per-language sort
    strongs_col: int  # 0-indexed TSV column for Strong's
    strongs_prefix: str  # "G" or "H"
    output_dir: Path
    label: str  # short label for log messages, e.g. "Greek-only" / "Hebrew-only"


GREEK = LangConfig(
    name="Greek",
    surface_header="greek",
    sort_col=COL_GREEK_SORT,
    strongs_col=COL_STR_GRK,
    strongs_prefix="G",
    output_dir=GREEK_TSV_DIR,
    label="Greek-only",
)

HEBREW = LangConfig(
    name="Hebrew",
    surface_header="hebrew",
    sort_col=COL_HEB_SORT,
    strongs_col=COL_STR_HEB,
    strongs_prefix="H",
    output_dir=HEBREW_TSV_DIR,
    label="Hebrew-only",
)


def build_lang_tsv(cfg: LangConfig) -> BuildStats:
    """Build a slim language-filtered TSV export, one file per book."""
    log(f"Building {cfg.label} TSV export...")

    if not BSB_TABLES_FILE.exists():
        log(f"ERROR: BSB tables file not found: {BSB_TABLES_FILE}")
        log("  Run: bash scripts/fetch-sources.sh")
        sys.exit(1)

    ensure_dir(cfg.output_dir)

    output_header = [
        "book",
        "chapter",
        "verse",
        "sort",
        cfg.surface_header,
        "strong",
        "bsb",
        "pnc",
    ]

    stats = BuildStats()
    rows_by_book: dict[str, list[list[str]]] = {}

    current_book: str | None = None
    current_chapter: int | None = None
    current_verse: int | None = None

    with open(BSB_TABLES_FILE, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        next(reader, None)  # skip header

        for row in reader:
            if len(row) <= COL_PNC:
                continue

            verse_id_col = row[COL_VERSE_ID]
            if verse_id_col and ":" in verse_id_col:
                parsed = parse_verse_id(verse_id_col)
                if parsed:
                    current_book, current_chapter, current_verse = parsed

            if row[COL_LANGUAGE] != cfg.name:
                continue

            if not current_book or current_chapter is None or current_verse is None:
                continue

            source = row[COL_SOURCE].strip()
            if not source:
                continue

            strongs_raw = row[cfg.strongs_col].strip()
            strong = f"{cfg.strongs_prefix}{strongs_raw}" if strongs_raw else ""

            bsb = row[COL_BSB].strip()
            pnc = row[COL_PNC].strip()
            sort_val = row[cfg.sort_col].strip()

            rows_by_book.setdefault(current_book, []).append(
                [
                    current_book,
                    str(current_chapter),
                    str(current_verse),
                    sort_val,
                    source,
                    strong,
                    bsb,
                    pnc,
                ]
            )

            stats.total_words += 1
            if strong:
                stats.words_with_strongs += 1
                stats.unique_strongs.add(strong)

    files_written = 0
    for book_code, rows in sorted(rows_by_book.items()):
        out_path = cfg.output_dir / f"{book_code}.tsv"
        with open(out_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f, delimiter="\t", lineterminator="\n")
            writer.writerow(output_header)
            writer.writerows(rows)
        files_written += 1
        stats.books_processed += 1

    verses_seen: set[tuple[str, str, str]] = set()
    for rows in rows_by_book.values():
        for r in rows:
            verses_seen.add((r[0], r[1], r[2]))
    stats.total_verses = len(verses_seen)

    stats_dict = stats.to_dict()
    stats_dict["files_written"] = files_written
    write_json(cfg.output_dir / "stats.json", stats_dict)

    total_size = sum(p.stat().st_size for p in cfg.output_dir.rglob("*.tsv"))
    log("")
    log(f"=== {cfg.label} TSV Build Complete ===")
    log(f"Books processed: {stats.books_processed}")
    log(f"Total verses: {stats.total_verses}")
    log(f"Total {cfg.name} rows: {stats.total_words}")
    log(f"Rows with Strong's: {stats.words_with_strongs}")
    log(f"Unique Strong's: {len(stats.unique_strongs)}")
    log(f"Files written: {files_written}")
    log(f"Total output size: {format_file_size(total_size)}")

    return stats
