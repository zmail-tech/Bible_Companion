# BSB Bible Data Preprocessing Pipeline

Convert BSB-USJ source data into optimized formats for web display and vector DB indexing.

## Output Repository

**Generated data is published to a separate repository for easy downstream use:**

👉 **[bsb-data-output](https://github.com/USER/bsb-data-output)** *(update USER to your GitHub username)*

This repository contains only the build scripts. The output data is automatically
rebuilt and published when source data changes.

## Output Formats

### Display Format (`base/display/`)
- **License:** CC0 (Public Domain)
- **Format:** JSONL files per chapter, organized by book
- **Purpose:** Compact format for web rendering with Strong's numbers and original language text

Structure: `display/{BOOK}/{BOOK}{chapter}.jsonl` (e.g., `display/GEN/GEN1.jsonl`)

Each line is a single verse with both English and original language (Hebrew/Greek):
```json
{"eng":{1:[["In the beginning","H7225"],["God","H430"],["created","H1254"],...]},"heb":{1:[["בְּרֵאשִׁ֖ית","H7225"],["בָּרָ֣א","H1254"],["אֱלֹהִ֑ים","H430"],...]}}}
```

For NT books, `grk` is used instead of `heb`:
```json
{"eng":{1:[["[This is the] record","G976"],["of [the] genealogy","G1078"],...]},"grk":{1:[["Βίβλος","G976"],["γενέσεως","G1078"],...]}}}
```

### Index Format - PD (`vector-db/index-pd/`)
- **License:** CC0 (Public Domain)
- **Format:** Single JSONL file with all verses
- **Purpose:** Vector DB indexing with cross-references, topics, and glosses

```json
{"id":"GEN.1.1","b":"GEN","c":1,"v":1,"t":"In the beginning...","s":["H7225","H430"],"x":["JHN.1.1"],"tp":["Creation"],"g":{"H7225":"beginning"}}
```

### Index Format - CC-BY (`vector-db/index-cc-by/`)
- **License:** CC-BY 4.0 (includes OSHB morphology)
- **Format:** Single JSONL file with all verses
- **Purpose:** Vector DB indexing with full morphological data

Includes all PD fields plus morphology:
```json
{"m":[{"s":"H7225","m":"HR/Ncfsa","p":"noun","l":"רֵאשִׁית"},...]}
```

### Index Format - CC-BY Split (`base/index-cc-by/`)
- **License:** CC-BY 4.0 (includes OSHB morphology)
- **Format:** JSONL files per chapter, organized by book
- **Purpose:** Same as vector-db/index-cc-by but split for easier chapter-by-chapter access

Structure: `index-cc-by/{BOOK}/{BOOK}{chapter}.jsonl` (e.g., `index-cc-by/GEN/GEN1.jsonl`)

### Concordance Index (`base/concordance/`)
- **License:** CC0 (Public Domain)
- **Format:** JSON and JSONL mapping Strong's numbers to verse references
- **Purpose:** Pre-built concordance for lookups by Strong's number

```json
{"H1": ["GEN.1.1", "GEN.2.4", ...], "H2": ["GEN.4.1", ...], "G1": ["MAT.1.1", ...]}
```

Also available as JSONL for streaming:
```json
{"strongs": "H1", "verses": ["GEN.1.1", "GEN.2.4", ...]}
```

### English Concordance Index (`base/english-concordance/`)
- **License:** CC0 (Public Domain)
- **Format:** JSON and JSONL mapping English words to verse references
- **Purpose:** Pre-built concordance for lookups by English word

```json
{"Aaron": ["EXO.4.14", "EXO.4.27", ...], "God": ["GEN.1.1", "GEN.1.2", ...], "love": ["GEN.22.2", ...]}
```

Also available as JSONL for streaming:
```json
{"word": "Aaron", "verses": ["EXO.4.14", "EXO.4.27", ...]}
```

Contains ~14,600 unique entries including proper nouns, common words, and numbers. Statistics include occurrence counts for the most frequent words.

### Geography (`base/geography/`)
- **License:** CC-BY 4.0 (OpenBible)
- **Format:** JSON and JSONL
- **Purpose:** Geographic data for 1,342 biblical places with coordinates, types, modern identifications, and cross-links

```json
{"id":"Abana","name":"Abana","type":"place","coordinates":{"lat":33.51,"lon":36.31,"precision":"exact"},"verses":["2KI.5.12"],"place_types":["river"],"name_variants":[{"name":"Abana","count":8},{"name":"Abanah","count":2}],"modern_place":{"id":"m39ac0b","name":"Barada River"},"tipnr_id":"Abana_2Ki_5_12","wikidata_id":"Q765106","confidence_score":1000}
```

Key fields:
- `place_types` — 38 categories: settlement, river, mountain, valley, island, spring, etc.
- `name_variants` — how each translation names the place (e.g., Abana vs Abanah) with occurrence counts
- `modern_place` — link to modern identification (e.g., "Barada River")
- `tipnr_id` — cross-reference to proper-names output for joining datasets
- `wikidata_id` — Wikidata entity ID (655 places) for external linking
- `confidence_score` — identification confidence (0-1000)

1,342 places total: 1,309 with coordinates, 1,285 with verse references, 8,742 total verse refs.

### Proper Names (`base/proper-names/`)
- **License:** CC-BY 4.0 (STEPBible TIPNR)
- **Format:** JSON and JSONL for people, places, and other entities
- **Purpose:** Disambiguated proper names with genealogy and verse references

```json
{"id":"Aaron_Exo_4_14","uniqueName":"Aaron@Exo.4.14","type":"person","relations":{"father":"Amram_Exo_6_18","offspring":["Nadab_Exo_6_23"]},"names":[{"ESV_translation":"Aaron","strongs":"H0175","verses":["EXO.4.14"]}]}
```

Distinguishes individuals sharing the same name (e.g., 6 different Marys). Includes 3,124 people, 997 places, and 112 other entries.

### Versification Mappings (`base/versification/`)
- **License:** CC-BY-SA 4.0 (UBS Paratext)
- **Format:** JSON per tradition, plus lookup tables and JSONL
- **Purpose:** Verse number mappings between English, Hebrew, LXX, and Vulgate traditions

```json
{"tradition":"eng","eng_to_tradition":{"GEN.31.55":"GEN.32.1","PSA.13.1":"PSA.13.2"},"tradition_to_eng":{"GEN.32.1":"GEN.31.55"}}
```

Covers 4 traditions with 9,658 total verse mappings. Includes `max_verses.json` with chapter/verse counts.

### Extended Lexicon (`base/lexicon/`)
- **License:** CC-BY 4.0 (STEPBible TBESH/TBESG)
- **Format:** JSON and JSONL for Hebrew and Greek entries
- **Purpose:** Extended Strong's lexicon with corrected definitions from BDB (Hebrew) and Abbott-Smith (Greek)

```json
{"strongs":"H3068","language":"hebrew","lemma":"יְהֹוָה","transliteration":"ye.ho.vah","gloss":"LORD","definition":"1) the proper name of the one true God..."}
```

20,192 entries (9,345 Hebrew + 10,847 Greek). Includes `glosses.json` lightweight lookup and `combined_compat.json` with non-padded keys (H1) matching concordance format.

### HelloAO Format (`base/helloao/`)
- **License:** CC0 (Public Domain)
- **Format:** JSON files organized by book/chapter
- **Purpose:** Compatible with [bible.helloao.org](https://bible.helloao.org/docs/) API format

Structure: `helloao/{BOOK}/{chapter}.json` plus `helloao/books.json`
```json
{
  "translation": {"id": "BSB", "name": "Berean Standard Bible", ...},
  "book": {"id": "GEN", "name": "Genesis", "number": 1},
  "chapter": {"number": 1, "content": [{"type": "verse", "number": 1, "content": [...]}], "footnotes": []}
}
```

### Text-Only Format (`base/text-only/`)
- **License:** CC0 (Public Domain)
- **Format:** Plain text files, one per chapter
- **Purpose:** Simple text extraction for processing, search indexing, or reading

Filename pattern: `{BOOK}_{CCC}_BSB.txt` (e.g., `GEN_001_BSB.txt`)
Each verse on its own line.

### Headings Index (`base/headings.jsonl`)
- **License:** CC0 (Public Domain)
- **Format:** Single JSONL file with all section headings
- **Purpose:** Section headings with cross-references to verses

```json
{"id":"GEN.s1.1","b":"GEN","c":1,"before_v":1,"level":"s1","text":"The Creation"}
{"id":"GEN.s1.2","b":"GEN","c":1,"before_v":3,"level":"s1","text":"The First Day"}
```

Headings are cross-linked with verses via the `h` field in index files.

## For Downstream Projects

The data repository is designed to be extended. Projects can:

1. **Fork** the data repo and add custom enrichments
2. **Submodule** it into your project: `git submodule add https://github.com/.../bsb-data-output.git data/bsb`
3. **Clone** and extend with your own data

All schemas use `additionalProperties: true` to allow adding custom fields.

See the [data repository](https://github.com/USER/bsb-data-output) for full documentation.

## Local Development

### Requirements

- Python 3.10+
- Git
- npm (for fetching STEPBible lexicon data)
- Python package: `openpyxl` (for BSB concordance XLSX to CSV conversion)
- Python package: `usfmtc` (for USJ parsing)

### Quick Start

```bash
# 1. Clone this repo
git clone https://github.com/USER/bsb-data.git
cd bsb-data

# 2. Fetch source data
bash scripts/fetch-sources.sh

# 3. Build all outputs
python3 -m scripts.build

# 4. Or build specific outputs
python3 -m scripts.build --display
python3 -m scripts.build --index-pd
python3 -m scripts.build --index-cc-by
python3 -m scripts.build --index-cc-by-split
python3 -m scripts.build --concordance
python3 -m scripts.build --english-concordance
python3 -m scripts.build --helloao
python3 -m scripts.build --text-only
python3 -m scripts.build --geography
python3 -m scripts.build --proper-names
python3 -m scripts.build --versification
python3 -m scripts.build --lexicon

# 5. Validate outputs
python3 -m scripts.validate
```

### Output Location

After building, output is in:
```
output/
├── base/
│   ├── display/              # Per-chapter JSONL files with eng + heb/grk
│   ├── index-cc-by/          # CC-BY index split by chapter
│   ├── concordance/          # Strong's to verse mapping
│   ├── english-concordance/  # English words to verse mapping
│   ├── geography/            # Geographic coordinates for places
│   ├── proper-names/         # Disambiguated proper names with genealogy
│   ├── versification/        # Verse mappings across traditions
│   ├── lexicon/              # Extended Strong's lexicon (Hebrew + Greek)
│   ├── helloao/              # HelloAO-compatible JSON by book/chapter
│   ├── text-only/            # Plain text files per chapter
│   └── headings.jsonl        # Section headings index
├── vector-db/
│   ├── index-pd/             # Public Domain index with headings
│   └── index-cc-by/          # CC-BY index with morphology
├── schema/                   # JSON schemas
├── VERSION.json              # Source versions
└── README.md                 # Generated readme for data repo
```

## Automated Publishing

A GitHub Actions workflow automatically:

1. Runs weekly (or on manual trigger)
2. Checks if source repositories have changed
3. Rebuilds all outputs if needed
4. Publishes to the data repository with version tags

### Setup for Your Fork

1. Create a data repository (e.g., `bsb-data-output`)
2. Create a Personal Access Token with `repo` scope
3. Add secrets/variables to this repository:
   - **Secret:** `DATA_REPO_TOKEN` - your PAT
   - **Variable:** `DATA_REPO` - data repo name (default: `bsb-data-output`)
   - **Variable:** `DATA_REPO_OWNER` - owner (default: same as this repo)

## Data Sources

| Source | License | Content |
|--------|---------|---------|
| [BSB-USJ](https://github.com/BSB-publishing/bsb2usfm) | CC0 | Berean Standard Bible text with Strong's numbers |
| [Scrollmapper Bible DBs](https://github.com/scrollmapper/bible_databases) | Public Domain | TSK cross-references, Nave's topics, Strong's lexicon |
| [OpenScriptures OSHB](https://github.com/openscriptures/morphhb) | CC-BY 4.0 | Hebrew morphology data |
| [BSB Concordance](https://bereanbible.com/bsb_concordance.xlsx) | CC0 | English word concordance (XLSX, auto-converted to CSV) |
| [OpenScriptures Strong's](https://github.com/openscriptures/strongs) | CC-BY-SA | Strong's Hebrew/Greek dictionaries |
| [CCEL Nave's](https://www.ccel.org/) | Public Domain | Nave's Topical Bible (XML) |
| [OpenBible Geocoding](https://github.com/openbibleinfo/Bible-Geocoding-Data) | CC-BY 4.0 | 1,342 biblical places with coordinates, types, modern IDs, Wikidata links |
| [STEPBible TIPNR](https://github.com/STEPBible/STEPBible-Data) | CC-BY 4.0 | Proper name disambiguation with genealogy |
| [STEPBible TBESH/TBESG](https://www.npmjs.com/package/@metaxia/scriptures-source-stepbible-lexicon) | CC-BY 4.0 | Extended Strong's lexicon (Hebrew BDB + Greek Abbott-Smith) |
| [UBS Paratext Versification](https://github.com/ubsicap/versification_json) | CC-BY-SA 4.0 | Versification mappings (English, LXX, Vulgate, Original) |
| [UBS Dictionaries](https://github.com/ubsicap/ubs-open-license) | CC-BY-SA 4.0 | Hebrew/Greek dictionaries and MARBLE semantic links |

## Repository Structure

```
bsb-data/
├── .github/
│   └── workflows/
│       └── build-publish.yml  # Automated build & publish
├── scripts/
│   ├── build.py                    # Main build script
│   ├── build_display.py            # Build display output
│   ├── build_index_pd.py           # Build PD index
│   ├── build_index_cc_by.py        # Build CC-BY index
│   ├── build_index_cc_by_split.py  # Build CC-BY index split by chapter
│   ├── build_concordance.py        # Build Strong's concordance
│   ├── build_english_concordance.py # Build English word concordance
│   ├── build_geography.py          # Build geographic coordinates
│   ├── build_proper_names.py       # Build proper names (TIPNR)
│   ├── build_versification.py      # Build versification mappings
│   ├── build_lexicon.py            # Build extended Strong's lexicon
│   ├── build_helloao.py            # Build HelloAO-compatible output
│   ├── build_text_only.py          # Build text-only output
│   ├── build_headings.py           # Extract section headings
│   ├── convert_usj.py              # USJ parser
│   ├── convert_xlsx_to_csv.py      # XLSX to CSV converter
│   ├── enrich_*.py                 # Enrichment modules
│   ├── fetch-sources.sh            # Download all source data
│   ├── generate_metadata.py        # Generate schemas & VERSION.json
│   ├── schemas.py                  # JSON schema definitions
│   ├── validate.py                 # Output validation
│   ├── types.py                    # Type definitions
│   └── utils.py                    # Shared utilities
├── sources/                         # Downloaded source data (gitignored)
│   ├── bsb-usj/                    # BSB text in USJ format (CC0)
│   ├── bsb-tables/                 # BSB word-level parsing tables (CC0)
│   ├── bsb_concordance/            # BSB English concordance XLSX/CSV (CC0)
│   ├── bible-databases/            # TSK cross-refs, Nave's topics (PD)
│   ├── openscriptures-strongs/     # Strong's Hebrew/Greek dictionaries (CC-BY-SA)
│   ├── oshb/                       # Hebrew morphology (CC-BY 4.0)
│   ├── ccel-naves/                 # Nave's Topical Bible XML (PD)
│   ├── ubs-dictionaries/           # UBS dictionaries + MARBLE (CC-BY-SA 4.0)
│   ├── openbible-geocoding/        # Geographic data JSONL (CC-BY 4.0)
│   ├── stepbible-tipnr/            # Proper names JSON (CC-BY 4.0)
│   ├── stepbible-lexicon/          # Extended Strong's lexicon JSON (CC-BY 4.0)
│   └── versification/              # UBS versification JSON (CC-BY-SA 4.0)
├── output/                          # Build output (gitignored, published separately)
├── README.md
├── LICENSE-CC0.md
├── LICENSE-CC-BY.md
└── ATTRIBUTION.md
```

## License

- **Code in this repo:** CC0 (Public Domain)
- **Output data:** See individual directories (CC0 or CC-BY 4.0)

See [LICENSE-CC0.md](LICENSE-CC0.md) and [LICENSE-CC-BY.md](LICENSE-CC-BY.md) for full license texts.
