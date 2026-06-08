"""JSON Schema definitions for BSB Data formats."""

WORD_ARRAY_SCHEMA = {
    "type": "object",
    "description": "Verse number mapped to word pairs array",
    "patternProperties": {
        "^\\d+$": {
            "type": "array",
            "description": "Word pairs: [text, strongs|null]",
            "items": {
                "type": "array",
                "minItems": 2,
                "maxItems": 2,
                "items": [
                    {"type": "string", "description": "Text content (word or punctuation)"},
                    {
                        "type": ["string", "null"],
                        "description": "Strong's number (H1234 or G1234) or null",
                        "pattern": "^[HG]\\d{1,4}[a-z]?$",
                    },
                ],
            },
        }
    },
    "additionalProperties": False,
}

DISPLAY_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://github.com/bsb-data/schema/display.schema.json",
    "title": "BSB Display Verse",
    "description": "Verse format with English text and original language (Hebrew/Greek) for web rendering.",
    "type": "object",
    "required": ["eng"],
    "properties": {
        "eng": {
            **WORD_ARRAY_SCHEMA,
            "description": "English text in BSB word order",
        },
        "heb": {
            **WORD_ARRAY_SCHEMA,
            "description": "Hebrew text in Hebrew word order (OT only)",
        },
        "grk": {
            **WORD_ARRAY_SCHEMA,
            "description": "Greek text in Greek word order (NT only)",
        },
    },
    "additionalProperties": False,
    "examples": [
        {
            "eng": {1: [["In the beginning", "H7225"], ["God", "H430"], ["created", "H1254"]]},
            "heb": {1: [["בְּרֵאשִׁ֖ית", "H7225"], ["בָּרָ֣א", "H1254"], ["אֱלֹהִ֑ים", "H430"]]},
        }
    ],
}

INDEX_PD_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://github.com/bsb-data/schema/vector-db/index-pd.schema.json",
    "title": "BSB Index Verse (Public Domain)",
    "description": "Enriched verse format for vector DB indexing - Public Domain content only",
    "type": "object",
    "required": ["id", "b", "c", "v", "t", "s", "x", "tp", "g"],
    "properties": {
        "id": {
            "type": "string",
            "description": "Unique verse identifier",
            "pattern": "^[A-Z0-9]{3}\\.\\d+\\.\\d+$",
            "examples": ["GEN.1.1", "JHN.3.16", "1CO.13.4"],
        },
        "b": {
            "type": "string",
            "description": "Book code (3-letter identifier)",
            "pattern": "^[A-Z0-9]{3}$",
        },
        "c": {"type": "integer", "description": "Chapter number", "minimum": 1},
        "v": {"type": "integer", "description": "Verse number", "minimum": 1},
        "t": {"type": "string", "description": "Plain text content of the verse"},
        "s": {
            "type": "array",
            "description": "Strong's numbers appearing in this verse",
            "items": {"type": "string", "pattern": "^[HG]\\d{1,4}[a-z]?$"},
        },
        "x": {
            "type": "array",
            "description": "Cross-reference verse IDs from Treasury of Scripture Knowledge",
            "items": {"type": "string", "pattern": "^[A-Z0-9]{3}\\.\\d+\\.\\d+$"},
        },
        "tp": {
            "type": "array",
            "description": "Topic names from Nave's Topical Bible",
            "items": {"type": "string"},
        },
        "g": {
            "type": "object",
            "description": "Glosses/definitions for Strong's numbers in this verse",
            "additionalProperties": {"type": "string"},
            "propertyNames": {"pattern": "^[HG]\\d{1,4}[a-z]?$"},
        },
        "citations": {
            "type": "array",
            "description": "Scripture citations from footnotes (e.g., references to parallel passages)",
            "items": {"type": "string"},
            "examples": [["2CO 4:6", "HEB 11:3"]],
        },
        "h": {
            "type": "array",
            "description": "Heading IDs that appear before this verse (cross-reference to headings.jsonl)",
            "items": {"type": "string", "pattern": "^[A-Z0-9]{3}\\.(s[1-5]|r|d|mr|ms[12])\\.\\d+$"},
            "examples": [["GEN.s1.1", "GEN.r.1"]],
        },
    },
    "additionalProperties": True,
}

INDEX_CC_BY_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://github.com/bsb-data/schema/vector-db/index-cc-by.schema.json",
    "title": "BSB Index Verse (CC-BY)",
    "description": "Enriched verse format with OSHB morphology - requires CC-BY 4.0 attribution",
    "type": "object",
    "required": ["id", "b", "c", "v", "t", "s", "x", "tp", "g", "m"],
    "allOf": [{"$ref": "vector-db/index-pd.schema.json"}],
    "properties": {
        "m": {
            "type": "array",
            "description": "Morphology entries from OpenScriptures Hebrew Bible (CC-BY 4.0)",
            "items": {
                "type": "object",
                "required": ["s", "m", "p", "l"],
                "properties": {
                    "s": {
                        "type": "string",
                        "description": "Strong's number",
                        "pattern": "^[HG]\\d{1,4}[a-z]?$",
                    },
                    "m": {"type": "string", "description": "Morphology code (e.g., 'HR/Ncfsa')"},
                    "p": {
                        "type": "string",
                        "description": "Part of speech (noun, verb, adjective, etc.)",
                    },
                    "l": {"type": "string", "description": "Lemma (original Hebrew/Greek word)"},
                },
                "additionalProperties": True,
            },
        }
    },
    "additionalProperties": True,
}

# Headings schema
HEADINGS_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://github.com/bsb-data/schema/headings.schema.json",
    "title": "BSB Heading",
    "description": "Section heading with bidirectional verse cross-reference",
    "type": "object",
    "required": ["id", "b", "c", "before_v", "level", "text"],
    "properties": {
        "id": {
            "type": "string",
            "description": "Unique heading ID",
            "pattern": "^[A-Z0-9]{3}\\.(s[1-5]|r|d|mr|ms[12])\\.\\d+$",
            "examples": ["GEN.s1.1", "GEN.r.1", "PSA.d.1"],
        },
        "b": {
            "type": "string",
            "description": "Book code (3-letter identifier)",
            "pattern": "^[A-Z0-9]{3}$",
        },
        "c": {"type": "integer", "description": "Chapter number", "minimum": 1},
        "before_v": {
            "type": "integer",
            "description": "Verse number that follows this heading",
            "minimum": 1,
        },
        "level": {
            "type": "string",
            "description": "Heading level/type",
            "enum": ["s1", "s2", "s3", "s4", "s5", "r", "d", "mr", "ms1", "ms2", "sr"],
        },
        "text": {"type": "string", "description": "Heading text content"},
        "refs": {
            "type": "array",
            "description": "Scripture references (for 'r' type headings)",
            "items": {"type": "string"},
            "examples": [["JHN 1:1-5", "HEB 11:1-3"]],
        },
    },
    "additionalProperties": True,
}

# Book codes reference
BOOK_CODES_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://github.com/bsb-data/schema/book-codes.schema.json",
    "title": "BSB Book Codes",
    "description": "Reference for 3-letter book codes used in BSB Data",
    "type": "object",
    "const": {
        "OT": {
            "GEN": "Genesis",
            "EXO": "Exodus",
            "LEV": "Leviticus",
            "NUM": "Numbers",
            "DEU": "Deuteronomy",
            "JOS": "Joshua",
            "JDG": "Judges",
            "RUT": "Ruth",
            "1SA": "1 Samuel",
            "2SA": "2 Samuel",
            "1KI": "1 Kings",
            "2KI": "2 Kings",
            "1CH": "1 Chronicles",
            "2CH": "2 Chronicles",
            "EZR": "Ezra",
            "NEH": "Nehemiah",
            "EST": "Esther",
            "JOB": "Job",
            "PSA": "Psalms",
            "PRO": "Proverbs",
            "ECC": "Ecclesiastes",
            "SNG": "Song of Solomon",
            "ISA": "Isaiah",
            "JER": "Jeremiah",
            "LAM": "Lamentations",
            "EZK": "Ezekiel",
            "DAN": "Daniel",
            "HOS": "Hosea",
            "JOL": "Joel",
            "AMO": "Amos",
            "OBA": "Obadiah",
            "JON": "Jonah",
            "MIC": "Micah",
            "NAM": "Nahum",
            "HAB": "Habakkuk",
            "ZEP": "Zephaniah",
            "HAG": "Haggai",
            "ZEC": "Zechariah",
            "MAL": "Malachi",
        },
        "NT": {
            "MAT": "Matthew",
            "MRK": "Mark",
            "LUK": "Luke",
            "JHN": "John",
            "ACT": "Acts",
            "ROM": "Romans",
            "1CO": "1 Corinthians",
            "2CO": "2 Corinthians",
            "GAL": "Galatians",
            "EPH": "Ephesians",
            "PHP": "Philippians",
            "COL": "Colossians",
            "1TH": "1 Thessalonians",
            "2TH": "2 Thessalonians",
            "1TI": "1 Timothy",
            "2TI": "2 Timothy",
            "TIT": "Titus",
            "PHM": "Philemon",
            "HEB": "Hebrews",
            "JAS": "James",
            "1PE": "1 Peter",
            "2PE": "2 Peter",
            "1JN": "1 John",
            "2JN": "2 John",
            "3JN": "3 John",
            "JUD": "Jude",
            "REV": "Revelation",
        },
    },
}


PROPER_NAMES_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://github.com/bsb-data/schema/proper-names.schema.json",
    "title": "BSB Proper Name Entry",
    "description": "Disambiguated proper name (person, place, or other) from STEPBible TIPNR",
    "type": "object",
    "required": ["id", "uniqueName", "type"],
    "properties": {
        "id": {
            "type": "string",
            "description": "Unique identifier derived from uniqueName",
            "examples": ["Aaron_Exo_4_14", "Cyprus_Num_24_24"],
        },
        "uniqueName": {
            "type": "string",
            "description": "TIPNR unique name with defining reference",
            "examples": ["Aaron@Exo.4.14"],
        },
        "type": {
            "type": "string",
            "enum": ["person", "place", "other"],
            "description": "Category of proper name",
        },
        "description": {"type": "string", "description": "Brief description"},
        "placename": {"type": "string", "description": "Place name (places only)"},
        "coordinates": {
            "type": "object",
            "properties": {
                "lat": {"type": "number", "minimum": -90, "maximum": 90},
                "lon": {"type": "number", "minimum": -180, "maximum": 180},
            },
            "required": ["lat", "lon"],
        },
        "relations": {
            "type": "object",
            "description": "Family relationships (people only)",
            "properties": {
                "father": {"type": "string"},
                "mother": {"type": "string"},
                "siblings": {"type": "array", "items": {"type": "string"}},
                "partners": {"type": "array", "items": {"type": "string"}},
                "offspring": {"type": "array", "items": {"type": "string"}},
            },
        },
        "names": {
            "type": "array",
            "description": "Name forms with translations and Strong's numbers",
            "items": {
                "type": "object",
                "properties": {
                    "ESV_translation": {"type": "string"},
                    "NIV_translation": {"type": "string"},
                    "KJV_translation": {"type": "string"},
                    "strongs": {"type": "string"},
                    "hebrew_greek": {"type": "string"},
                    "verses": {
                        "type": "array",
                        "items": {"type": "string", "pattern": "^[A-Z0-9]{3}\\.\\d+\\.\\d+$"},
                    },
                },
            },
        },
        "verses": {
            "type": "array",
            "description": "All verse references (deduplicated across name forms)",
            "items": {"type": "string", "pattern": "^[A-Z0-9]{3}\\.\\d+\\.\\d+$"},
        },
    },
    "additionalProperties": True,
}

VERSIFICATION_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://github.com/bsb-data/schema/versification.schema.json",
    "title": "BSB Versification Tradition",
    "description": "Versification mapping data for a single tradition (English, LXX, Vulgate, etc.)",
    "type": "object",
    "required": ["tradition", "description", "max_verses", "verse_mappings", "stats"],
    "properties": {
        "tradition": {
            "type": "string",
            "description": "Tradition identifier",
            "enum": ["eng", "lxx", "vul", "org"],
        },
        "description": {"type": "string"},
        "max_verses": {
            "type": "object",
            "description": "Maximum verse count per chapter, keyed by book code",
            "patternProperties": {
                "^[A-Z0-9]{3}$": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 0},
                }
            },
        },
        "verse_mappings": {
            "type": "array",
            "description": "Verse-level mappings between English and this tradition",
            "items": {
                "type": "object",
                "required": ["eng", "other"],
                "properties": {
                    "eng": {"type": "string", "description": "English verse reference"},
                    "other": {"type": "string", "description": "Tradition verse reference"},
                },
            },
        },
        "excluded_verses": {
            "type": "array",
            "items": {"type": "string"},
        },
        "stats": {
            "type": "object",
            "properties": {
                "books": {"type": "integer"},
                "total_mappings": {"type": "integer"},
                "excluded_count": {"type": "integer"},
                "skipped_apocryphal": {"type": "integer"},
            },
        },
    },
    "additionalProperties": True,
}

LEXICON_ENTRY_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://github.com/bsb-data/schema/lexicon.schema.json",
    "title": "BSB Lexicon Entry",
    "description": "Extended Strong's lexicon entry from STEPBible TBESH/TBESG",
    "type": "object",
    "required": ["strongs", "language"],
    "properties": {
        "strongs": {
            "type": "string",
            "description": "Strong's number (zero-padded)",
            "pattern": "^[HG]\\d{4,5}[a-z]?$",
            "examples": ["H0001", "G3056"],
        },
        "language": {
            "type": "string",
            "enum": ["hebrew", "greek"],
        },
        "strongsExtended": {"type": "string", "description": "Extended Strong's number"},
        "strongsDisambiguated": {"type": "string"},
        "lemma": {"type": "string", "description": "Original language word form"},
        "transliteration": {"type": "string", "description": "Romanized form"},
        "morphology": {"type": "string", "description": "Morphology code"},
        "gloss": {"type": "string", "description": "Brief English meaning"},
        "definition": {"type": "string", "description": "Full definition (plain text)"},
    },
    "additionalProperties": True,
}


def get_all_schemas() -> dict[str, dict]:
    """Return all schemas as a dictionary.

    Keys are relative paths from the schema directory.
    Vector DB schemas are placed in a vector-db/ subdirectory.
    """
    return {
        "display.schema.json": DISPLAY_SCHEMA,
        "vector-db/index-pd.schema.json": INDEX_PD_SCHEMA,
        "vector-db/index-cc-by.schema.json": INDEX_CC_BY_SCHEMA,
        "headings.schema.json": HEADINGS_SCHEMA,
        "book-codes.schema.json": BOOK_CODES_SCHEMA,
        "proper-names.schema.json": PROPER_NAMES_SCHEMA,
        "versification.schema.json": VERSIFICATION_SCHEMA,
        "lexicon.schema.json": LEXICON_ENTRY_SCHEMA,
    }
