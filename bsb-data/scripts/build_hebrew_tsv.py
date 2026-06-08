#!/usr/bin/env python3
"""Build the Hebrew-only slim TSV export. Thin wrapper around build_lang_tsv."""

from .build_lang_tsv import HEBREW, build_lang_tsv
from .types import BuildStats


def build_hebrew_tsv() -> BuildStats:
    return build_lang_tsv(HEBREW)


def main() -> None:
    build_hebrew_tsv()


if __name__ == "__main__":
    main()
