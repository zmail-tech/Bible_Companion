# Attribution

This document contains the required attribution for content used in this project.

## Public Domain Content (CC0)

The following sources are in the public domain and require no attribution (though credit is appreciated):

### Berean Standard Bible (BSB-USJ)
- **Source:** https://github.com/BSB-publishing/bsb2usfm
- **License:** CC0 1.0 Universal
- **Description:** Bible text with Strong's numbers in USJ format

### Treasury of Scripture Knowledge (TSK)
- **Source:** https://github.com/scrollmapper/bible_databases
- **License:** Public Domain
- **Description:** Cross-reference data

### Nave's Topical Bible
- **Source:** https://github.com/scrollmapper/bible_databases
- **License:** Public Domain
- **Description:** Topical index

### Strong's Concordance
- **Source:** https://github.com/scrollmapper/bible_databases
- **License:** Public Domain
- **Description:** Hebrew and Greek lexicon data

### BSB English Concordance
- **Source:** Berean Bible (bereanbible.com/bsb_concordance.xlsx)
- **License:** CC0 1.0 Universal
- **Description:** English word concordance for BSB text (downloaded as XLSX, converted to CSV)

---

## CC-BY 4.0 Licensed Content

The following attribution is **required** when using data from these sources:

### STEPBible Data (TIPNR - Proper Names)

> Proper names data from STEPBible Data Repository.
> 
> **STEPBible** is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
> 
> Source: https://github.com/STEPBible/STEPBible-Data
> 
> Credit: STEP Bible (www.STEPBible.org)

### OpenBible Geocoding Data

> Geographic data (coordinates, place types, modern identifications, Wikidata links) from OpenBible Bible Geocoding Data.
>
> **OpenBible Geocoding** is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
>
> Source: https://github.com/openbibleinfo/Bible-Geocoding-Data
>
> © OpenBible.info

### STEPBible Extended Lexicons (TBESH/TBESG)

> Extended Strong's lexicon data from STEPBible Data Repository.
>
> **STEPBible** is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
>
> Source: https://github.com/STEPBible/STEPBible-Data
>
> JSON conversion: [@metaxia/scriptures-source-stepbible-lexicon](https://www.npmjs.com/package/@metaxia/scriptures-source-stepbible-lexicon)
>
> Credit: Tyndale House, Cambridge (www.STEPBible.org)

---

## CC-BY-SA 4.0 Licensed Content

The following attribution is **required** when using data from these sources:

### UBS Paratext Versification Data

> Versification mapping data from UBS Paratext versification_json.
>
> **UBS Versification** is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
>
> Source: https://github.com/ubsicap/versification_json
>
> © United Bible Societies

### UBS Dictionaries and MARBLE Index

> Hebrew and Greek dictionary data and MARBLE semantic links.
>
> **UBS Dictionaries** are licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
>
> Source: https://github.com/ubsicap/ubs-open-license
>
> © United Bible Societies

---

## CC-BY 4.0 Licensed Content (Morphology)

The following attribution is **required** when using the `output/index-cc-by/` data:

### Open Scriptures Hebrew Bible (OSHB)

> Morphological data derived from the Open Scriptures Hebrew Bible (OSHB).
> 
> **OSHB** is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
> 
> Source: https://github.com/openscriptures/morphhb
> 
> © Open Scriptures. For more information, visit https://hb.openscriptures.org/

### Copy-Paste Attribution (Short Form)

For use in applications or documentation:

```
Hebrew morphology data from Open Scriptures Hebrew Bible (OSHB), 
licensed under CC BY 4.0. https://hb.openscriptures.org/
```

### Copy-Paste Attribution (Long Form)

For README files or about pages:

```
This project includes morphological data derived from the Open Scriptures 
Hebrew Bible (OSHB), which is licensed under the Creative Commons 
Attribution 4.0 International License (CC BY 4.0).

For more information about OSHB, visit: https://hb.openscriptures.org/
Source repository: https://github.com/openscriptures/morphhb
```

---

## How to Determine Which License Applies

| Output Directory | License | Attribution Required |
|-----------------|---------|---------------------|
| `output/base/display/` | CC0 | No |
| `output/vector-db/index-pd/` | CC0 | No |
| `output/base/concordance/` | CC0 | No |
| `output/base/english-concordance/` | CC0 | No |
| `output/base/helloao/` | CC0 | No |
| `output/base/text-only/` | CC0 | No |
| `output/base/geography/` | CC-BY 4.0 | **Yes** (OpenBible) |
| `output/base/proper-names/` | CC-BY 4.0 | **Yes** (STEPBible TIPNR) |
| `output/base/lexicon/` | CC-BY 4.0 | **Yes** (STEPBible TBESH/TBESG) |
| `output/base/versification/` | CC-BY-SA 4.0 | **Yes** (UBS Paratext) |
| `output/vector-db/index-cc-by/` | CC-BY 4.0 | **Yes** (OSHB morphology) |
| `output/base/index-cc-by/` | CC-BY 4.0 | **Yes** (OSHB morphology) |

If you are unsure which data to use:
- Use `index-pd/` if you want to avoid attribution requirements
- Use `index-cc-by/` if you need morphological data and can provide attribution
