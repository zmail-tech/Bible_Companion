# Attribution

This project incorporates data and tools from the following sources. All original licenses remain in effect.

## Berean Standard Bible (BSB)

**Source:** https://github.com/BSB-publishing/bsb2usfm
**License:** CC0 1.0 Universal (Public Domain)

The Berean Standard Bible text used in this project is the work of the BSB Publishing team and translators. The BSB translation is dedicated to the public domain under CC0. The Bible text includes verse-by-verse parsing with Strong's concordance numbers in USJ format, converted from the USFM source maintained by BSB Publishing.

Website: https://www.bereanbible.com/

## BSB Data Preprocessing Pipeline

**License:** CC0 1.0 Universal (Code) / Mixed (Data, see below)

The `bsb-data/` directory contains a preprocessing pipeline built on the BSB-USJ source data pipeline. This pipeline converts USJ/USFM Bible text into optimized formats (JSONL, plain text, concordance indexes, etc.) for use by the web reader. The pipeline code is CC0, but the generated data may include third-party sources under CC-BY or CC-BY-SA licenses.

## Treasury of Scripture Knowledge (TSK)

**Source:** https://github.com/scrollmapper/bible_databases
**License:** Public Domain

Cross-reference data derived from the 1859 Treasury of Scripture Knowledge.

## Strong's Concordance

**Source:** https://github.com/scrollmapper/bible_databases
**License:** Public Domain

Hebrew and Greek lexicon data from James Strong's Original Hebrew and Greek English Concordance.

## Nave's Topical Bible

**Source:** https://github.com/scrollmapper/bible_databases
**License:** Public Domain

Topical index from Nave's Topical Bible (1896).

## BSB English Concordance

**Source:** https://bereanbible.com/bsb_concordance.xlsx
**License:** CC0 1.0 Universal

English word concordance for BSB text.

---

## CC-BY 4.0 Licensed Content (Attribution Required)

The following sources are used if the corresponding data directories are present. When these are included, the required attribution below applies.

### STEP Bible Data (TIPNR Proper Names)

Proper names data from STEP Bible Data Repository.

- **License:** CC BY 4.0
- **Source:** https://github.com/STEPBible/STEPBible-Data
- **Credit:** STEP Bible (https://www.stepbible.org)

### STEP Bible Extended Lexicons (TBESH / TBESG)

Extended Strong's lexicon data from STEP Bible Data Repository.

- **License:** CC BY 4.0
- **Source:** https://github.com/STEPBible/STEPBible-Data
- **JSON conversion:** https://www.npmjs.com/package/@metaxia/scriptures-source-stepbible-lexicon
- **Credit:** Tyndale House, Cambridge (https://www.stepbible.org)

### OpenBible Geocoding Data

Geographic data (coordinates, place types, modern identifications, Wikidata links).

- **License:** CC BY 4.0
- **Source:** https://github.com/openbibleinfo/Bible-Geocoding-Data
- **Credit:** OpenBible.info

### Open Scriptures Hebrew Bible (OSHB) Morphology

Hebrew morphological data.

- **License:** CC BY 4.0
- **Source:** https://github.com/openscriptures/morphhb
- **Website:** https://hb.openscriptures.org/

---

## CC-BY-SA 4.0 Licensed Content (Attribution Required)

### UBS Paratext Versification Data

Verse number mappings between English, Hebrew, LXX, and Vulgate traditions.

- **License:** CC BY-SA 4.0
- **Source:** https://github.com/ubsicap/versification_json
- **Credit:** United Bible Societies

### UBS Dictionaries and MARBLE Index

Hebrew and Greek dictionary data and MARBLE semantic links.

- **License:** CC BY-SA 4.0
- **Source:** https://github.com/ubsicap/ubs-open-license
- **Credit:** United Bible Societies

---

## Summary

| Component | License | Attribution Required |
|-----------|---------|---------------------|
| Original app code (HTML/JS/CSS) | MIT | No |
| BSB Bible text | CC0 | No |
| Pipeline code | CC0 | No |
| TSK cross-references | Public Domain | No |
| Strong's Concordance | Public Domain | No |
| Nave's Topical Bible | Public Domain | No |
| BSB English Concordance | CC0 | No |
| STEP Bible data | CC BY 4.0 | Yes |
| OpenBible Geocoding | CC BY 4.0 | Yes |
| OSHB morphology | CC BY 4.0 | Yes |
| UBS Paratext versification | CC BY-SA 4.0 | Yes |
| UBS Dictionaries | CC BY-SA 4.0 | Yes |

For full license texts, see `bsb-data/LICENSE-CC0.md`, `bsb-data/LICENSE-CC-BY.md`, and the respective source repositories.
