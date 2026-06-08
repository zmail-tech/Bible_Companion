"""Type definitions for BSB Data processing."""

from dataclasses import dataclass, field
from typing import TypedDict

# Book code mappings
BOOK_CODES: dict[int, str] = {
    1: "GEN",
    2: "EXO",
    3: "LEV",
    4: "NUM",
    5: "DEU",
    6: "JOS",
    7: "JDG",
    8: "RUT",
    9: "1SA",
    10: "2SA",
    11: "1KI",
    12: "2KI",
    13: "1CH",
    14: "2CH",
    15: "EZR",
    16: "NEH",
    17: "EST",
    18: "JOB",
    19: "PSA",
    20: "PRO",
    21: "ECC",
    22: "SNG",
    23: "ISA",
    24: "JER",
    25: "LAM",
    26: "EZK",
    27: "DAN",
    28: "HOS",
    29: "JOL",
    30: "AMO",
    31: "OBA",
    32: "JON",
    33: "MIC",
    34: "NAM",
    35: "HAB",
    36: "ZEP",
    37: "HAG",
    38: "ZEC",
    39: "MAL",
    40: "MAT",
    41: "MRK",
    42: "LUK",
    43: "JHN",
    44: "ACT",
    45: "ROM",
    46: "1CO",
    47: "2CO",
    48: "GAL",
    49: "EPH",
    50: "PHP",
    51: "COL",
    52: "1TH",
    53: "2TH",
    54: "1TI",
    55: "2TI",
    56: "TIT",
    57: "PHM",
    58: "HEB",
    59: "JAS",
    60: "1PE",
    61: "2PE",
    62: "1JN",
    63: "2JN",
    64: "3JN",
    65: "JUD",
    66: "REV",
}

# Reverse mapping: code to number
BOOK_NUMBERS: dict[str, int] = {code: num for num, code in BOOK_CODES.items()}

# USJ file naming pattern
USJ_FILES: dict[str, str] = {
    "GEN": "01GENBSB_full_strongs.usj",
    "EXO": "02EXOBSB_full_strongs.usj",
    "LEV": "03LEVBSB_full_strongs.usj",
    "NUM": "04NUMBSB_full_strongs.usj",
    "DEU": "05DEUBSB_full_strongs.usj",
    "JOS": "06JOSBSB_full_strongs.usj",
    "JDG": "07JDGBSB_full_strongs.usj",
    "RUT": "08RUTBSB_full_strongs.usj",
    "1SA": "091SABSB_full_strongs.usj",
    "2SA": "102SABSB_full_strongs.usj",
    "1KI": "111KIBSB_full_strongs.usj",
    "2KI": "122KIBSB_full_strongs.usj",
    "1CH": "131CHBSB_full_strongs.usj",
    "2CH": "142CHBSB_full_strongs.usj",
    "EZR": "15EZRBSB_full_strongs.usj",
    "NEH": "16NEHBSB_full_strongs.usj",
    "EST": "17ESTBSB_full_strongs.usj",
    "JOB": "18JOBBSB_full_strongs.usj",
    "PSA": "19PSABSB_full_strongs.usj",
    "PRO": "20PROBSB_full_strongs.usj",
    "ECC": "21ECCBSB_full_strongs.usj",
    "SNG": "22SNGBSB_full_strongs.usj",
    "ISA": "23ISABSB_full_strongs.usj",
    "JER": "24JERBSB_full_strongs.usj",
    "LAM": "25LAMBSB_full_strongs.usj",
    "EZK": "26EZKBSB_full_strongs.usj",
    "DAN": "27DANBSB_full_strongs.usj",
    "HOS": "28HOSBSB_full_strongs.usj",
    "JOL": "29JOLBSB_full_strongs.usj",
    "AMO": "30AMOBSB_full_strongs.usj",
    "OBA": "31OBABSB_full_strongs.usj",
    "JON": "32JONBSB_full_strongs.usj",
    "MIC": "33MICBSB_full_strongs.usj",
    "NAM": "34NAMBSB_full_strongs.usj",
    "HAB": "35HABBSB_full_strongs.usj",
    "ZEP": "36ZEPBSB_full_strongs.usj",
    "HAG": "37HAGBSB_full_strongs.usj",
    "ZEC": "38ZECBSB_full_strongs.usj",
    "MAL": "39MALBSB_full_strongs.usj",
    "MAT": "41MATBSB_full_strongs.usj",
    "MRK": "42MRKBSB_full_strongs.usj",
    "LUK": "43LUKBSB_full_strongs.usj",
    "JHN": "44JHNBSB_full_strongs.usj",
    "ACT": "45ACTBSB_full_strongs.usj",
    "ROM": "46ROMBSB_full_strongs.usj",
    "1CO": "471COBSB_full_strongs.usj",
    "2CO": "482COBSB_full_strongs.usj",
    "GAL": "49GALBSB_full_strongs.usj",
    "EPH": "50EPHBSB_full_strongs.usj",
    "PHP": "51PHPBSB_full_strongs.usj",
    "COL": "52COLBSB_full_strongs.usj",
    "1TH": "531THBSB_full_strongs.usj",
    "2TH": "542THBSB_full_strongs.usj",
    "1TI": "551TIBSB_full_strongs.usj",
    "2TI": "562TIBSB_full_strongs.usj",
    "TIT": "57TITBSB_full_strongs.usj",
    "PHM": "58PHMBSB_full_strongs.usj",
    "HEB": "59HEBBSB_full_strongs.usj",
    "JAS": "60JASBSB_full_strongs.usj",
    "1PE": "611PEBSB_full_strongs.usj",
    "2PE": "622PEBSB_full_strongs.usj",
    "1JN": "631JNBSB_full_strongs.usj",
    "2JN": "642JNBSB_full_strongs.usj",
    "3JN": "653JNBSB_full_strongs.usj",
    "JUD": "66JUDBSB_full_strongs.usj",
    "REV": "67REVBSB_full_strongs.usj",
}


# Display format - one line per verse in JSONL
class DisplayVerse(TypedDict, total=False):
    b: str  # Book code: "GEN", "EXO", etc.
    c: int  # Chapter number
    v: int  # Verse number
    w: list[tuple[str, str | None]]  # [text, strongs] pairs
    citations: list[str]  # Scripture citations from footnotes ["2CO 4:6", "HEB 11:3"]


# UBS Gloss entry (richer than basic Strong's definition)
class UBSGlossEntry(TypedDict, total=False):
    lemma: str  # Hebrew/Greek word (e.g., "אָב", "ἀγάπη")
    glosses: list[str]  # Translation options ["father", "ancestor"]
    def_: str  # Short definition (key is "def" in JSON, but "def_" in Python)
    xlit: str  # Transliteration (e.g., "ʼâb") - from OpenScriptures
    pron: str  # Pronunciation guide (e.g., "awb") - from OpenScriptures


# Index format - Public Domain only
class IndexVersePD(TypedDict, total=False):
    id: str  # "GEN.1.1"
    b: str  # Book code
    c: int  # Chapter
    v: int  # Verse
    t: str  # Plain text
    s: list[str]  # Strong's numbers array
    x: list[str]  # Cross-references ["JHN.1.1", "HEB.11.3"]
    tp: list[str]  # Topics from Nave's
    g: dict[str, str]  # Gloss/definitions {H7225: "beginning"} (basic for PD)
    citations: list[str]  # Scripture citations from footnotes
    h: list[str]  # Heading IDs that appear before this verse ["GEN.s1.1", "GEN.r.1"]


# Morphology entry for CC-BY content
class MorphologyEntry(TypedDict):
    s: str  # Strong's number
    m: str  # Morphology code "HR/Ncfsa"
    p: str  # Part of speech
    l: str  # Lemma (Hebrew/Greek word)


# Index format - CC-BY (includes morphology and UBS lexicon data)
class IndexVerseCCBY(TypedDict, total=False):
    id: str  # "GEN.1.1"
    b: str  # Book code
    c: int  # Chapter
    v: int  # Verse
    t: str  # Plain text
    s: list[str]  # Strong's numbers array
    x: list[str]  # Cross-references ["JHN.1.1", "HEB.11.3"]
    tp: list[str]  # Topics from Nave's
    g: dict[str, UBSGlossEntry]  # UBS gloss data (richer than PD)
    m: list[MorphologyEntry]  # Morphology data from OSHB
    dom: list[str]  # Semantic domains from UBS ["Family", "Creation"]
    citations: list[str]  # Scripture citations from footnotes
    h: list[str]  # Heading IDs that appear before this verse


# Cross-reference from scrollmapper format
class CrossReference(TypedDict):
    from_book: int
    from_chapter: int
    from_verse: int
    to_book: int
    to_chapter: int
    to_verse: int
    votes: int


# Strong's lexicon entry
class StrongsEntry(TypedDict):
    word: str
    translit: str
    gloss: str
    definition: str


# Statistics output
@dataclass
class BuildStats:
    total_verses: int = 0
    total_words: int = 0
    words_with_strongs: int = 0
    unique_strongs_numbers: int = 0
    total_cross_references: int = 0
    total_topics: int = 0
    books_processed: int = 0
    unique_strongs: set[str] = field(default_factory=set)

    def to_dict(self) -> dict:
        return {
            "total_verses": self.total_verses,
            "total_words": self.total_words,
            "words_with_strongs": self.words_with_strongs,
            "unique_strongs_numbers": len(self.unique_strongs),
            "total_cross_references": self.total_cross_references,
            "total_topics": self.total_topics,
            "books_processed": self.books_processed,
        }
