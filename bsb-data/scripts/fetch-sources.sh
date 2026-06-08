#!/bin/bash
# Fetch all source data for BSB Bible Data preprocessing
# Downloads only the specific files needed, not full repositories
#
# Usage:
#   bash scripts/fetch-sources.sh           # Download missing files and update changed files (default)
#   bash scripts/fetch-sources.sh --force   # Re-download all files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SOURCES_DIR="$PROJECT_DIR/sources"
TIMESTAMP_FILE="$SOURCES_DIR/.last_fetch"

# Parse command line arguments
FORCE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --force|-f)
            FORCE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --force, -f    Force re-download of all files"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "By default, the script downloads missing files and checks for updates."
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "=== BSB Data Source Fetcher ==="
echo "Project directory: $PROJECT_DIR"
echo "Sources directory: $SOURCES_DIR"
if [ "$FORCE" = true ]; then
    echo "Mode: FORCE (re-downloading all files)"
else
    echo "Mode: Default (download missing files and check for updates)"
fi
echo ""
echo "This script downloads only the required files (~305MB total)"
echo "instead of cloning full repositories (~12GB)."
echo ""

# Create sources directory if needed
mkdir -p "$SOURCES_DIR"

# Function to check if we should download a file
# Returns 0 (true) if should download, 1 (false) if should skip
should_download() {
    local file="$1"
    local url="$2"

    # Force mode: always download
    if [ "$FORCE" = true ]; then
        return 0
    fi

    # File doesn't exist: download
    if [ ! -f "$file" ]; then
        return 0
    fi

    # Check remote timestamp to see if file has been updated
    # Use subshell to prevent set -e from exiting on errors
    local remote_date
    remote_date=$(curl -sI "$url" 2>/dev/null | grep -i "last-modified" | cut -d' ' -f2- | tr -d '\r') || true

    if [ -n "$remote_date" ]; then
        # Cross-platform date parsing (works on both macOS and Linux)
        local remote_ts="0"
        local local_ts="0"

        if date --version >/dev/null 2>&1; then
            # GNU date (Linux)
            remote_ts=$(date -d "$remote_date" "+%s" 2>/dev/null) || remote_ts="0"
            local_ts=$(stat -c "%Y" "$file" 2>/dev/null) || local_ts="0"
        else
            # BSD date (macOS)
            remote_ts=$(date -j -f "%a, %d %b %Y %H:%M:%S %Z" "$remote_date" "+%s" 2>/dev/null) || remote_ts="0"
            local_ts=$(stat -f "%m" "$file" 2>/dev/null) || local_ts="0"
        fi

        if [ "$remote_ts" != "0" ] && [ "$local_ts" != "0" ] && [ "$remote_ts" -gt "$local_ts" ]; then
            return 0  # Remote is newer
        fi
    fi

    # File exists and is up to date (or couldn't check): skip
    return 1
}

# Function to download a file with optional update checking
download_file() {
    local url="$1"
    local dest="$2"
    local desc="$3"

    if should_download "$dest" "$url"; then
        echo "  Downloading $desc..."
        if ! curl -fL --retry 3 --retry-delay 2 "$url" -o "$dest"; then
            echo "    Warning: Failed to download $desc from $url"
            return 1
        fi
        return 0
    else
        return 1  # Skipped
    fi
}

# OT books in OSHB naming convention
OSHB_BOOKS=(
    "Gen" "Exod" "Lev" "Num" "Deut"
    "Josh" "Judg" "Ruth" "1Sam" "2Sam"
    "1Kgs" "2Kgs" "1Chr" "2Chr" "Ezra"
    "Neh" "Esth" "Job" "Ps" "Prov"
    "Eccl" "Song" "Isa" "Jer" "Lam"
    "Ezek" "Dan" "Hos" "Joel" "Amos"
    "Obad" "Jonah" "Mic" "Nah" "Hab"
    "Zeph" "Hag" "Zech" "Mal"
)

# ============================================================================
# 1. Fetch BSB-USJ data (CC0)
#
# Upstream restructured in 2026 — USJ files are no longer served as raw files
# under main/results_usj/. They are now packaged as zips on GitHub releases.
# We download the BSB_usj.zip (plain) and BSB_full_strongs_usj.zip (with
# Strong's) assets from the latest release and extract them into the same
# layout that previously existed under sources/bsb-usj/results_usj/.
# ============================================================================
echo "--- Fetching BSB-USJ data (CC0) ---"

USJ_RELEASE_TAG_FILE="$SOURCES_DIR/bsb-usj/.release_tag"
USJ_RELEASES_BASE="https://github.com/BSB-publishing/bsb2usfm/releases"

# Resolve the latest release tag once (avoids hitting GitHub API rate limits
# more than necessary). Fall back to "latest" if the lookup fails.
USJ_LATEST_TAG=$(curl -sI "$USJ_RELEASES_BASE/latest" 2>/dev/null \
    | grep -i '^location:' | sed 's|.*/tag/||' | tr -d '\r\n')
if [ -z "$USJ_LATEST_TAG" ]; then
    USJ_LATEST_TAG="latest"
    USJ_DOWNLOAD_PREFIX="$USJ_RELEASES_BASE/latest/download"
else
    USJ_DOWNLOAD_PREFIX="$USJ_RELEASES_BASE/download/$USJ_LATEST_TAG"
fi

# Determine the previously-fetched tag (if any) for skip logic
USJ_CACHED_TAG=""
if [ -f "$USJ_RELEASE_TAG_FILE" ]; then
    USJ_CACHED_TAG=$(cat "$USJ_RELEASE_TAG_FILE" 2>/dev/null | tr -d '\r\n')
fi

# fetch_and_extract_usj_zip <asset_name> <dest_dir> <description>
# Downloads the named zip asset from the resolved release and unzips it into
# dest_dir, overwriting existing files. Returns 0 if extraction happened, 1 if
# skipped.
fetch_and_extract_usj_zip() {
    local asset="$1"
    local dest_dir="$2"
    local desc="$3"

    if [ "$FORCE" != true ] \
       && [ -n "$USJ_CACHED_TAG" ] \
       && [ "$USJ_CACHED_TAG" = "$USJ_LATEST_TAG" ] \
       && [ -d "$dest_dir" ] \
       && [ "$(ls -1 "$dest_dir"/*.usj 2>/dev/null | wc -l | tr -d ' ')" -gt 0 ]; then
        echo "  $desc up to date (release $USJ_CACHED_TAG)"
        return 1
    fi

    local url="$USJ_DOWNLOAD_PREFIX/$asset"
    local tmp_zip
    tmp_zip=$(mktemp -t bsb-usj-XXXXXX.zip)

    echo "  Downloading $desc ($asset @ $USJ_LATEST_TAG)..."
    if ! curl -fL --retry 3 --retry-delay 2 "$url" -o "$tmp_zip"; then
        echo "    Warning: Failed to download $asset from $url"
        rm -f "$tmp_zip"
        return 1
    fi

    mkdir -p "$dest_dir"
    if ! unzip -q -o "$tmp_zip" -d "$dest_dir"; then
        echo "    Warning: Failed to extract $asset"
        rm -f "$tmp_zip"
        return 1
    fi
    rm -f "$tmp_zip"
    return 0
}

# 1a. strongs_full USJ files (with Strong's numbers)
USJ_STRONGS_DIR="$SOURCES_DIR/bsb-usj/results_usj/strongs_full"
fetch_and_extract_usj_zip \
    "BSB_full_strongs_usj.zip" \
    "$USJ_STRONGS_DIR" \
    "Strong's USJ files" || true
USJ_COUNT=$(ls -1 "$USJ_STRONGS_DIR"/*.usj 2>/dev/null | wc -l | tr -d ' ')
echo "Strong's USJ files: $USJ_COUNT"

# 1b. Plain USJ files (without Strong's numbers — for text extraction)
USJ_PLAIN_DIR="$SOURCES_DIR/bsb-usj/results_usj/plain"
fetch_and_extract_usj_zip \
    "BSB_usj.zip" \
    "$USJ_PLAIN_DIR" \
    "Plain USJ files" || true
USJ_PLAIN_COUNT=$(ls -1 "$USJ_PLAIN_DIR"/*.usj 2>/dev/null | wc -l | tr -d ' ')
echo "Plain USJ files: $USJ_PLAIN_COUNT"

# Persist the resolved tag so subsequent runs can skip the (large) zip
# downloads when the upstream release hasn't moved.
mkdir -p "$SOURCES_DIR/bsb-usj"
echo "$USJ_LATEST_TAG" > "$USJ_RELEASE_TAG_FILE"
echo ""

# ============================================================================
# 2. Fetch cross-references from Scrollmapper Bible Databases
# ============================================================================
echo "--- Fetching Cross-References (Public Domain) ---"
XREF_DIR="$SOURCES_DIR/bible-databases/sources/extras"
mkdir -p "$XREF_DIR"

XREF_DOWNLOADED=0
BASE_URL="https://raw.githubusercontent.com/scrollmapper/bible_databases/master/sources/extras"

for i in 0 1 2 3 4 5 6; do
    FILE="cross_references_$i.json"
    if download_file "$BASE_URL/$FILE" "$XREF_DIR/$FILE" "$FILE"; then
        XREF_DOWNLOADED=$((XREF_DOWNLOADED + 1))
    fi
done

# Also get the text version for reference
download_file "$BASE_URL/cross_references.txt" "$XREF_DIR/cross_references.txt" "cross_references.txt" || true

XREF_COUNT=$(ls -1 "$XREF_DIR"/cross_references*.json 2>/dev/null | wc -l | tr -d ' ')
if [ "$XREF_DOWNLOADED" -gt 0 ]; then
    echo "Downloaded $XREF_DOWNLOADED cross-reference files (total: $XREF_COUNT)"
else
    echo "Cross-reference files up to date ($XREF_COUNT files)"
fi
echo ""

# ============================================================================
# 2b. Fetch Strong's lexicon from OpenScriptures (CC-BY-SA)
# ============================================================================
echo "--- Fetching Strong's Lexicon (CC-BY-SA) ---"
STRONGS_DIR="$SOURCES_DIR/openscriptures-strongs"
mkdir -p "$STRONGS_DIR"

STRONGS_LEX_DOWNLOADED=0

# Hebrew Strong's dictionary (JS format with JSON object)
if download_file "https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js" \
                 "$STRONGS_DIR/strongs-hebrew-dictionary.js" "strongs-hebrew-dictionary.js"; then
    STRONGS_LEX_DOWNLOADED=$((STRONGS_LEX_DOWNLOADED + 1))
fi

# Greek Strong's dictionary (JS format with JSON object)
if download_file "https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js" \
                 "$STRONGS_DIR/strongs-greek-dictionary.js" "strongs-greek-dictionary.js"; then
    STRONGS_LEX_DOWNLOADED=$((STRONGS_LEX_DOWNLOADED + 1))
fi

if [ "$STRONGS_LEX_DOWNLOADED" -gt 0 ]; then
    echo "Downloaded $STRONGS_LEX_DOWNLOADED Strong's lexicon files"
else
    echo "Strong's lexicon files up to date"
fi
echo ""

# ============================================================================
# 2c. Fetch Nave's Topical Bible from CCEL (Public Domain)
# ============================================================================
echo "--- Fetching Nave's Topical Bible (Public Domain) ---"
NAVES_DIR="$SOURCES_DIR/ccel-naves"
mkdir -p "$NAVES_DIR"

NAVES_DOWNLOADED=0

# CCEL provides Nave's in ThML (XML) format with structured verse references
if download_file "https://www.ccel.org/ccel/nave/bible.xml" \
                 "$NAVES_DIR/naves-topical-bible.xml" "naves-topical-bible.xml"; then
    NAVES_DOWNLOADED=$((NAVES_DOWNLOADED + 1))
fi

if [ "$NAVES_DOWNLOADED" -gt 0 ]; then
    echo "Downloaded Nave's Topical Bible (CCEL XML)"
else
    echo "Nave's Topical Bible up to date"
fi
echo ""

# ============================================================================
# 3. Fetch BSB Tables (CC0)
# ============================================================================
echo "--- Fetching BSB Tables (CC0) ---"
BSB_TABLES_DIR="$SOURCES_DIR/bsb-tables"
mkdir -p "$BSB_TABLES_DIR"

BSB_TABLES_URL="https://bereanbible.com/bsb_tables.tsv"
if download_file "$BSB_TABLES_URL" "$BSB_TABLES_DIR/bsb_tables.tsv" "bsb_tables.tsv"; then
    echo "Downloaded bsb_tables.tsv"
else
    echo "bsb_tables.tsv up to date"
fi
echo ""

# ============================================================================
# 4. Fetch OpenScriptures OSHB (CC-BY 4.0)
# ============================================================================
echo "--- Fetching OpenScriptures OSHB (CC-BY 4.0) ---"
OSHB_DIR="$SOURCES_DIR/oshb/wlc"
mkdir -p "$OSHB_DIR"

OSHB_DOWNLOADED=0
BASE_URL="https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc"

for BOOK in "${OSHB_BOOKS[@]}"; do
    FILE="${BOOK}.xml"
    if download_file "$BASE_URL/$FILE" "$OSHB_DIR/$FILE" "$FILE"; then
        OSHB_DOWNLOADED=$((OSHB_DOWNLOADED + 1))
    fi
done

OSHB_COUNT=$(ls -1 "$OSHB_DIR"/*.xml 2>/dev/null | wc -l | tr -d ' ')
if [ "$OSHB_DOWNLOADED" -gt 0 ]; then
    echo "Downloaded $OSHB_DOWNLOADED OSHB XML files (total: $OSHB_COUNT)"
else
    echo "OSHB files up to date ($OSHB_COUNT files)"
fi
echo ""

# ============================================================================
# 5. Fetch UBS Dictionaries (CC-BY-SA 4.0)
# ============================================================================
echo "--- Fetching UBS Dictionaries (CC-BY-SA 4.0) ---"
UBS_DIR="$SOURCES_DIR/ubs-dictionaries"
mkdir -p "$UBS_DIR"

UBS_DOWNLOADED=0

# Hebrew dictionary (latest version)
if download_file "https://raw.githubusercontent.com/ubsicap/ubs-open-license/main/dictionaries/hebrew/JSON/UBSHebrewDic-v0.9.1-en.JSON" \
                 "$UBS_DIR/UBSHebrewDic-en.json" "UBS Hebrew Dictionary"; then
    UBS_DOWNLOADED=$((UBS_DOWNLOADED + 1))
fi

# Greek dictionary (latest version)
if download_file "https://raw.githubusercontent.com/ubsicap/ubs-open-license/main/dictionaries/greek/JSON/UBSGreekNTDic-v1.1-en.JSON" \
                 "$UBS_DIR/UBSGreekNTDic-en.json" "UBS Greek Dictionary"; then
    UBS_DOWNLOADED=$((UBS_DOWNLOADED + 1))
fi

if [ "$UBS_DOWNLOADED" -gt 0 ]; then
    echo "Downloaded $UBS_DOWNLOADED UBS dictionary files"
else
    echo "UBS dictionary files up to date"
fi
echo ""

# ============================================================================
# 6. Fetch UBS Additional Resources (CC-BY-SA 4.0)
# ============================================================================
echo "--- Fetching UBS Additional Resources (CC-BY-SA 4.0) ---"

# 6a. Lexical Domains (taxonomy hierarchy)
if download_file "https://raw.githubusercontent.com/ubsicap/ubs-open-license/main/dictionaries/hebrew/JSON/UBSHebrewDicLexicalDomains-v0.9.1-en.JSON" \
                 "$UBS_DIR/UBSHebrewDicLexicalDomains-en.json" "Hebrew Lexical Domains"; then
    UBS_DOWNLOADED=$((UBS_DOWNLOADED + 1))
fi

if download_file "https://raw.githubusercontent.com/ubsicap/ubs-open-license/main/dictionaries/greek/JSON/UBSGreekNTDicLexicalDomains-v1.1-en.JSON" \
                 "$UBS_DIR/UBSGreekNTDicLexicalDomains-en.json" "Greek Lexical Domains"; then
    UBS_DOWNLOADED=$((UBS_DOWNLOADED + 1))
fi

# 6b. Contextual Domains (Hebrew only - figurative usage)
if download_file "https://raw.githubusercontent.com/ubsicap/ubs-open-license/main/dictionaries/hebrew/JSON/UBSHebrewDicContextualDomains-v0.9.1-en.JSON" \
                 "$UBS_DIR/UBSHebrewDicContextualDomains-en.json" "Hebrew Contextual Domains"; then
    UBS_DOWNLOADED=$((UBS_DOWNLOADED + 1))
fi

# 6c. Parallel Passages
if download_file "https://raw.githubusercontent.com/ubsicap/ubs-open-license/main/parallel%20passages/ParallelPassages.xml" \
                 "$UBS_DIR/ParallelPassages.xml" "Parallel Passages"; then
    UBS_DOWNLOADED=$((UBS_DOWNLOADED + 1))
fi

echo ""

# ============================================================================
# 7. Fetch WLC MARBLE Index (CC-BY-SA 4.0)
# ============================================================================
echo "--- Fetching WLC MARBLE Index (CC-BY-SA 4.0) ---"
MARBLE_DIR="$UBS_DIR/marble"
mkdir -p "$MARBLE_DIR"

# OT book codes for MARBLE index
MARBLE_BOOKS=(
    "GEN" "EXO" "LEV" "NUM" "DEU"
    "JOS" "JDG" "RUT" "1SA" "2SA"
    "1KI" "2KI" "1CH" "2CH" "EZR"
    "NEH" "EST" "JOB" "PSA" "PRO"
    "ECC" "SNG" "ISA" "JER" "LAM"
    "EZK" "DAN" "HOS" "JOL" "AMO"
    "OBA" "JON" "MIC" "NAM" "HAB"
    "ZEP" "HAG" "ZEC" "MAL"
)

MARBLE_DOWNLOADED=0
BASE_URL="https://raw.githubusercontent.com/ubsicap/ubs-open-license/main/index/WLC/JSON"

for BOOK in "${MARBLE_BOOKS[@]}"; do
    FILE="MARBLELinks-${BOOK}.json"
    if download_file "$BASE_URL/$FILE" "$MARBLE_DIR/$FILE" "$FILE"; then
        MARBLE_DOWNLOADED=$((MARBLE_DOWNLOADED + 1))
    fi
done

MARBLE_COUNT=$(ls -1 "$MARBLE_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
if [ "$MARBLE_DOWNLOADED" -gt 0 ]; then
    echo "Downloaded $MARBLE_DOWNLOADED MARBLE index files (total: $MARBLE_COUNT)"
else
    echo "MARBLE index files up to date ($MARBLE_COUNT files)"
fi
echo ""

# ============================================================================
# 8. Fetch OpenBible Geocoding Data (CC-BY 4.0)
# ============================================================================
echo "--- Fetching OpenBible Geocoding Data (CC-BY 4.0) ---"
GEOCODING_DIR="$SOURCES_DIR/openbible-geocoding"
mkdir -p "$GEOCODING_DIR"

GEOCODING_DOWNLOADED=0
BASE_URL="https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data"

for GEO_FILE in ancient.jsonl modern.jsonl; do
    if download_file "$BASE_URL/$GEO_FILE" "$GEOCODING_DIR/$GEO_FILE" "$GEO_FILE"; then
        GEOCODING_DOWNLOADED=$((GEOCODING_DOWNLOADED + 1))
    fi
done

if [ "$GEOCODING_DOWNLOADED" -gt 0 ]; then
    echo "Downloaded $GEOCODING_DOWNLOADED geocoding files"
else
    echo "Geocoding files up to date"
fi
echo ""

# ============================================================================
# 9. Fetch BSB Concordance (CC0)
# ============================================================================
echo "--- Fetching BSB Concordance (CC0) ---"
BSB_CONCORDANCE_DIR="$SOURCES_DIR/bsb_concordance"
mkdir -p "$BSB_CONCORDANCE_DIR"

BSB_CONC_DOWNLOADED=0

if download_file "https://bereanbible.com/bsb_concordance.xlsx" \
                 "$BSB_CONCORDANCE_DIR/bsb_concordance.xlsx" "bsb_concordance.xlsx"; then
    BSB_CONC_DOWNLOADED=1
fi

# Convert XLSX to CSV if xlsx is newer or csv is missing
if [ -f "$BSB_CONCORDANCE_DIR/bsb_concordance.xlsx" ]; then
    if [ ! -f "$BSB_CONCORDANCE_DIR/bsb_concordance.csv" ] || \
       [ "$BSB_CONCORDANCE_DIR/bsb_concordance.xlsx" -nt "$BSB_CONCORDANCE_DIR/bsb_concordance.csv" ] || \
       [ "$BSB_CONC_DOWNLOADED" -eq 1 ]; then
        echo "  Converting XLSX to CSV..."
        if python3 "$SCRIPT_DIR/convert_xlsx_to_csv.py" \
                   "$BSB_CONCORDANCE_DIR/bsb_concordance.xlsx" \
                   "$BSB_CONCORDANCE_DIR/bsb_concordance.csv"; then
            echo "  Conversion complete"
        else
            echo "  WARNING: XLSX to CSV conversion failed (openpyxl required: pip install openpyxl)"
        fi
    else
        echo "bsb_concordance.csv up to date"
    fi
else
    echo "  WARNING: Could not download bsb_concordance.xlsx"
fi
echo ""

# ============================================================================
# 10. Fetch STEPBible TIPNR Proper Names (CC-BY 4.0)
# ============================================================================
echo "--- Fetching STEPBible TIPNR Proper Names (CC-BY 4.0) ---"
TIPNR_DIR="$SOURCES_DIR/stepbible-tipnr"
mkdir -p "$TIPNR_DIR"

TIPNR_DOWNLOADED=0
BASE_URL="https://raw.githubusercontent.com/robertrouse/STEPBible-Data/master/json"

for TIPNR_FILE in TIPNR_people.json TIPNR_places.json TIPNR_other.json; do
    if download_file "$BASE_URL/$TIPNR_FILE" "$TIPNR_DIR/$TIPNR_FILE" "$TIPNR_FILE"; then
        TIPNR_DOWNLOADED=$((TIPNR_DOWNLOADED + 1))
    fi
done

if [ "$TIPNR_DOWNLOADED" -gt 0 ]; then
    echo "Downloaded $TIPNR_DOWNLOADED TIPNR JSON files"
else
    echo "TIPNR files up to date"
fi
echo ""

# ============================================================================
# 11. Fetch STEPBible Extended Strong's Lexicons (CC-BY 4.0)
# ============================================================================
echo "--- Fetching STEPBible Extended Lexicons (CC-BY 4.0) ---"
LEXICON_DIR="$SOURCES_DIR/stepbible-lexicon"
mkdir -p "$LEXICON_DIR"

LEXICON_DOWNLOADED=0

# Check if lexicon files already exist
if [ ! -f "$LEXICON_DIR/stepbible-tbesh.json" ] || [ ! -f "$LEXICON_DIR/stepbible-tbesg.json" ] || [ "$FORCE" = true ]; then
    echo "  Downloading from npm package @metaxia/scriptures-source-stepbible-lexicon..."
    LEXICON_TMP=$(mktemp -d)
    if npm pack @metaxia/scriptures-source-stepbible-lexicon --pack-destination "$LEXICON_TMP" >/dev/null 2>&1; then
        tar xzf "$LEXICON_TMP"/metaxia-scriptures-source-stepbible-lexicon-*.tgz -C "$LEXICON_TMP"
        cp "$LEXICON_TMP/package/data/stepbible-tbesh.json" "$LEXICON_DIR/"
        cp "$LEXICON_TMP/package/data/stepbible-tbesg.json" "$LEXICON_DIR/"
        LEXICON_DOWNLOADED=2
        echo "  Downloaded Hebrew (TBESH) and Greek (TBESG) lexicons"
    else
        echo "  Warning: Failed to download lexicon package (npm required)"
    fi
    rm -rf "$LEXICON_TMP"
else
    echo "  STEPBible lexicon files up to date"
fi
echo ""

# ============================================================================
# 12. Fetch UBS Versification Data (CC-BY-SA 4.0)
# ============================================================================
echo "--- Fetching Versification Data (CC-BY-SA 4.0) ---"
VERSIFICATION_DIR="$SOURCES_DIR/versification"
mkdir -p "$VERSIFICATION_DIR"

VERS_DOWNLOADED=0
BASE_URL="https://raw.githubusercontent.com/ubsicap/versification_json/master/examples"

for VERS_FILE in eng.json lxx.json vul.json org.json; do
    if download_file "$BASE_URL/$VERS_FILE" "$VERSIFICATION_DIR/$VERS_FILE" "$VERS_FILE"; then
        VERS_DOWNLOADED=$((VERS_DOWNLOADED + 1))
    fi
done

if [ "$VERS_DOWNLOADED" -gt 0 ]; then
    echo "Downloaded $VERS_DOWNLOADED versification files"
else
    echo "Versification files up to date"
fi
echo ""

# ============================================================================
# Summary
# ============================================================================

# Update timestamp file
date -u "+%Y-%m-%dT%H:%M:%SZ" > "$TIMESTAMP_FILE"

echo "=== Fetch complete ==="
echo ""
echo "Source data locations:"
echo "  BSB-USJ (Strong's): $USJ_STRONGS_DIR/ ($USJ_COUNT files)"
echo "  BSB-USJ (plain):    $USJ_PLAIN_DIR/ ($USJ_PLAIN_COUNT files)"
echo "  Cross-refs:         $XREF_DIR/ ($XREF_COUNT files)"
echo "  Strong's lexicon:   $STRONGS_DIR/"
echo "  Nave's topics:      $NAVES_DIR/"
echo "  BSB Tables:         $BSB_TABLES_DIR/"
echo "  OSHB:               $OSHB_DIR/ ($OSHB_COUNT files)"
echo "  UBS Dictionaries:   $UBS_DIR/"
echo "  UBS MARBLE Index:   $MARBLE_DIR/ ($MARBLE_COUNT files)"
echo "  Geocoding:          $GEOCODING_DIR/"
echo "  BSB Concordance:    $BSB_CONCORDANCE_DIR/"
echo "  TIPNR (names):      $TIPNR_DIR/"
echo "  STEPBible Lexicons: $LEXICON_DIR/"
echo "  Versification:      $VERSIFICATION_DIR/"
echo ""

# Show total size
TOTAL_SIZE=$(du -sh "$SOURCES_DIR" 2>/dev/null | cut -f1)
echo "Total source data size: $TOTAL_SIZE"

# Show last fetch time
if [ -f "$TIMESTAMP_FILE" ]; then
    echo "Last fetch: $(cat "$TIMESTAMP_FILE")"
fi

echo ""
echo "Next steps:"
echo "  source venv/bin/activate"
echo "  python3 -m scripts.build"
