# Thin wrapper around scripts/fetch-sources.sh and scripts/build.py.
# Use `make help` to see available targets.

PYTHON ?= python3
BUILD  := $(PYTHON) -m scripts.build

# USJ-dependent builders — re-run these after fetching a new BSB-USJ release.
USJ_BUILDERS := --display --index-cc-by --index-cc-by-split --helloao --text-only

.PHONY: help fetch fetch-force build all validate \
        display index-pd index-cc-by index-cc-by-split helloao text-only \
        concordance english-concordance geography proper-names versification lexicon \
        greek-tsv hebrew-tsv lang-tsv \
        refresh-from-usj clean-output

help:
	@echo "Source data:"
	@echo "  make fetch              Download/refresh source data (USJ, TSV, OSHB, …)"
	@echo "  make fetch-force        Re-download all source data, ignoring caches"
	@echo ""
	@echo "Build everything:"
	@echo "  make all                Run the full build pipeline (validate at end)"
	@echo "  make validate           Validate existing outputs"
	@echo ""
	@echo "Individual builders:"
	@echo "  make display            Per-chapter JSON for web display"
	@echo "  make index-pd           Public-domain index"
	@echo "  make index-cc-by        CC-BY index (single file)"
	@echo "  make index-cc-by-split  CC-BY index (per-chapter)"
	@echo "  make helloao            HelloAO output"
	@echo "  make text-only          Plain-text per-chapter files"
	@echo "  make concordance        Greek/Hebrew concordance"
	@echo "  make english-concordance"
	@echo "  make geography"
	@echo "  make proper-names"
	@echo "  make versification"
	@echo "  make lexicon"
	@echo "  make greek-tsv          Slim Greek-only TSV export"
	@echo "  make hebrew-tsv         Slim Hebrew-only TSV export"
	@echo "  make lang-tsv           Both greek-tsv + hebrew-tsv"
	@echo ""
	@echo "Composite:"
	@echo "  make refresh-from-usj   fetch + rebuild all USJ-dependent outputs"
	@echo "                          ($(USJ_BUILDERS))"

fetch:
	bash scripts/fetch-sources.sh

fetch-force:
	bash scripts/fetch-sources.sh --force

all:
	$(BUILD) --all

validate:
	$(BUILD) --validate

display:
	$(BUILD) --display

index-pd:
	$(BUILD) --index-pd

index-cc-by:
	$(BUILD) --index-cc-by

index-cc-by-split:
	$(BUILD) --index-cc-by-split

helloao:
	$(BUILD) --helloao

text-only:
	$(BUILD) --text-only

concordance:
	$(BUILD) --concordance

english-concordance:
	$(BUILD) --english-concordance

geography:
	$(BUILD) --geography

proper-names:
	$(BUILD) --proper-names

versification:
	$(BUILD) --versification

lexicon:
	$(BUILD) --lexicon

greek-tsv:
	$(BUILD) --greek-tsv

hebrew-tsv:
	$(BUILD) --hebrew-tsv

lang-tsv: greek-tsv hebrew-tsv

# Fetch a fresh BSB-USJ release and rebuild every output that depends on it.
refresh-from-usj: fetch
	$(BUILD) $(USJ_BUILDERS)
