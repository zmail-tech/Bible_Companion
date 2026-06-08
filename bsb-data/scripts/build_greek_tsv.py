#!/usr/bin/env python3
"""Build the Greek-only slim TSV export. Thin wrapper around build_lang_tsv."""

from .build_lang_tsv import GREEK, build_lang_tsv
from .types import BuildStats


def build_greek_tsv() -> BuildStats:
    return build_lang_tsv(GREEK)


def main() -> None:
    build_greek_tsv()


if __name__ == "__main__":
    main()
