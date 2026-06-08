#!/usr/bin/env python3
"""Generate metadata files: schemas, VERSION.json, README for output."""

import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from .schemas import get_all_schemas
from .utils import OUTPUT_DIR, SCHEMA_DIR, SOURCES_DIR, ensure_dir, log, write_json

# GitHub repo info for source data
SOURCE_REPOS = {
    "bsb_usj": {"owner": "BSB-publishing", "repo": "bsb2usfm", "branch": "main"},
    "bible_databases": {"owner": "scrollmapper", "repo": "bible_databases", "branch": "master"},
    "oshb": {"owner": "openscriptures", "repo": "morphhb", "branch": "master"},
}


def get_github_commit_info(owner: str, repo: str, branch: str = "main") -> dict[str, str]:
    """Get the latest commit info from a GitHub repository via API."""
    url = f"https://api.github.com/repos/{owner}/{repo}/commits/{branch}"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/vnd.github.v3+json"})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            return {
                "sha": data["sha"],
                "date": data["commit"]["committer"]["date"],
            }
    except Exception as e:
        log(f"  Warning: Could not fetch commit info for {owner}/{repo}: {e}")
        return {"sha": "unknown", "date": "unknown"}


def generate_schemas() -> None:
    """Write JSON schema files to output/schema/."""
    log("Generating JSON schemas...")
    ensure_dir(SCHEMA_DIR)

    schemas = get_all_schemas()
    for filename, schema in schemas.items():
        path = SCHEMA_DIR / filename
        ensure_dir(path.parent)
        write_json(path, schema)
        log(f"  Wrote {filename}")


def generate_version_json() -> None:
    """Generate VERSION.json with source versions and build info."""
    log("Generating VERSION.json...")

    # Fetch latest commit info from GitHub for each source repo
    bsb_repo = SOURCE_REPOS["bsb_usj"]
    bsb_info = get_github_commit_info(bsb_repo["owner"], bsb_repo["repo"], bsb_repo["branch"])

    bible_db_repo = SOURCE_REPOS["bible_databases"]
    bible_db_info = get_github_commit_info(
        bible_db_repo["owner"], bible_db_repo["repo"], bible_db_repo["branch"]
    )

    oshb_repo = SOURCE_REPOS["oshb"]
    oshb_info = get_github_commit_info(oshb_repo["owner"], oshb_repo["repo"], oshb_repo["branch"])

    version_data = {
        "build_date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sources": {
            "bsb_usj": {
                "repo": f"https://github.com/{bsb_repo['owner']}/{bsb_repo['repo']}",
                "sha": bsb_info["sha"],
                "date": bsb_info["date"],
            },
            "bible_databases": {
                "repo": f"https://github.com/{bible_db_repo['owner']}/{bible_db_repo['repo']}",
                "sha": bible_db_info["sha"],
                "date": bible_db_info["date"],
            },
            "oshb": {
                "repo": f"https://github.com/{oshb_repo['owner']}/{oshb_repo['repo']}",
                "sha": oshb_info["sha"],
                "date": oshb_info["date"],
                "license": "CC-BY 4.0",
            },
        },
    }

    write_json(OUTPUT_DIR / "VERSION.json", version_data)
    log("  Wrote VERSION.json")


def generate_output_readme() -> None:
    """Generate README.md for the output directory (data repo)."""
    log("Generating output README.md...")

    readme_content = """# BSB Bible Data

Auto-generated Bible data files from the Berean Standard Bible with Strong's numbers,
cross-references, topics, and morphology.

> **Note:** Do not edit these files directly. They are rebuilt automatically from
> source data by the bsb-data build pipeline.

## Directory Structure

```
.
├── base/                    # Core data files
│   ├── display/             # Per-chapter JSONL for web rendering
│   │   └── {BOOK}/
│   │       └── {BOOK}{chapter}.jsonl
│   ├── index-cc-by/         # CC-BY index split by chapter (CC-BY 4.0)
│   │   └── {BOOK}/
│   │       └── {BOOK}{chapter}.jsonl
│   ├── concordance/         # Strong's to verse mapping
│   │   ├── strongs-to-verses.json
│   │   └── strongs-to-verses.jsonl
│   └── headings.jsonl       # Section headings index
├── vector-db/               # Vector DB index files
│   ├── index-pd/            # Vector DB index (Public Domain)
│   │   └── bible-index.jsonl
│   └── index-cc-by/         # Vector DB index with morphology (CC-BY 4.0)
│       └── bible-index.jsonl
├── schema/                  # JSON schemas for all formats
│   ├── display.schema.json
│   ├── headings.schema.json
│   ├── book-codes.schema.json
│   └── vector-db/
│       ├── index-pd.schema.json
│       └── index-cc-by.schema.json
├── VERSION.json             # Source versions and build date
└── README.md                # This file
```

## Licenses

| Directory | License | Attribution Required |
|-----------|---------|---------------------|
| `base/display/` | CC0 (Public Domain) | No |
| `base/index-cc-by/` | CC-BY 4.0 | **Yes** |
| `base/concordance/` | CC0 (Public Domain) | No |
| `vector-db/index-pd/` | CC0 (Public Domain) | No |
| `vector-db/index-cc-by/` | CC-BY 4.0 | **Yes** |
| `schema/` | CC0 (Public Domain) | No |

### CC-BY Attribution (required for index-cc-by)

When using `base/index-cc-by/` or `vector-db/index-cc-by/` data, include this attribution:

> Hebrew morphology data from [Open Scriptures Hebrew Bible (OSHB)](https://hb.openscriptures.org/),
> licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Data Formats

### Display Format (`base/display/{BOOK}/{BOOK}{chapter}.jsonl`)

Compact format with English and original language (Hebrew/Greek) text. Each line is a single verse:

```json
{"eng":{1:[["In the beginning","H7225"],["God","H430"],["created","H1254"],...]},"heb":{1:[["בְּרֵאשִׁ֖ית","H7225"],["בָּרָ֣א","H1254"],["אֱלֹהִ֑ים","H430"],...]}}
```

For NT books, `grk` is used instead of `heb`:
```json
{"eng":{1:[["[This is the] record","G976"],["of [the] genealogy","G1078"],...]},"grk":{1:[["Βίβλος","G976"],["γενέσεως","G1078"],...]}}
```

### Index Format (`vector-db/index-pd/bible-index.jsonl`)

Enriched format for vector DB indexing:

```json
{
  "id": "GEN.1.1",
  "b": "GEN",
  "c": 1,
  "v": 1,
  "t": "In the beginning God created the heavens and the earth.",
  "s": ["H7225", "H430", "H1254", "H8064", "H853", "H776"],
  "x": ["JHN.1.1", "HEB.11.3", "PSA.33.6"],
  "tp": ["Creation", "God, Creator"],
  "g": {"H7225": "beginning", "H430": "God", "H1254": "to create"}
}
```

### Index Format with Morphology (`vector-db/index-cc-by/bible-index.jsonl`)

Same as index-pd plus morphology data:

```json
{
  "...all index-pd fields...",
  "m": [
    {"s": "H7225", "m": "HR/Ncfsa", "p": "noun", "l": "רֵאשִׁית"},
    {"s": "H430", "m": "HNcmpa", "p": "noun", "l": "אֱלֹהִים"}
  ]
}
```

## For Downstream Projects

This data is designed to be extended. To add your own enrichments:

1. Fork or clone this repository
2. Read from `base/` directories
3. Write your enhanced data to a new directory (e.g., `enhanced/`)
4. The schemas allow `additionalProperties` for custom fields

Example structure for an enhanced project:

```
your-project/
├── bsb-data-output/          # This repo as submodule
│   └── base/
├── scripts/
│   └── enhance.py            # Your enrichment code
└── enhanced/
    └── bible-enhanced.jsonl  # Your output with added fields
```

## Version Info

See [VERSION.json](VERSION.json) for source commit SHAs and build timestamp.

## Source Repositories

- **BSB-USJ:** https://github.com/BSB-publishing/bsb2usfm
- **Bible Databases:** https://github.com/scrollmapper/bible_databases
- **OSHB:** https://github.com/openscriptures/morphhb
"""

    with open(OUTPUT_DIR / "README.md", "w") as f:
        f.write(readme_content)

    log("  Wrote README.md")


def main() -> None:
    """Generate all metadata files."""
    log("=== Generating Metadata ===")
    log("")

    generate_schemas()
    generate_version_json()
    generate_output_readme()

    log("")
    log("Metadata generation complete!")


if __name__ == "__main__":
    main()
