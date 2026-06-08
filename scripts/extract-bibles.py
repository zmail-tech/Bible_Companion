#!/usr/bin/env python3
"""Extract Bible text from EPUB files and output JSON data files."""

import json, os, re, zipfile
from html import unescape

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_DIR, "data")
BIBLES_DIR = os.path.join(PROJECT_DIR, "bibles")

BOOK_ORDER = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther",
    "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon",
    "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel",
    "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
    "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
    "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
]

CHAPTER_COUNTS = {
    "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36,
    "Deuteronomy": 34, "Joshua": 24, "Judges": 21, "Ruth": 4,
    "1 Samuel": 31, "2 Samuel": 24, "1 Kings": 22, "2 Kings": 25,
    "1 Chronicles": 29, "2 Chronicles": 36, "Ezra": 10, "Nehemiah": 13,
    "Esther": 10, "Job": 42, "Psalms": 150, "Proverbs": 31,
    "Ecclesiastes": 12, "Song of Solomon": 8, "Isaiah": 66,
    "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12,
    "Hosea": 14, "Joel": 3, "Amos": 9, "Obadiah": 1, "Jonah": 4,
    "Micah": 7, "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3,
    "Haggai": 2, "Zechariah": 14, "Malachi": 4,
    "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, "Acts": 28,
    "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13,
    "Galatians": 6, "Ephesians": 6, "Philippians": 4, "Colossians": 4,
    "1 Thessalonians": 5, "2 Thessalonians": 3, "1 Timothy": 6,
    "2 Timothy": 4, "Titus": 3, "Philemon": 1, "Hebrews": 13,
    "James": 5, "1 Peter": 5, "2 Peter": 3, "1 John": 5,
    "2 John": 1, "3 John": 1, "Jude": 1, "Revelation": 22
}

BOOK_ALIASES = {
    "genesis": "Genesis", "exodus": "Exodus", "leviticus": "Leviticus",
    "numbers": "Numbers", "deuteronomy": "Deuteronomy", "josua": "Joshua",
    "judges": "Judges", "ruth": "Ruth", "esther": "Esther", "job": "Job",
    "psalms": "Psalms", "the psalms": "Psalms", "proverbs": "Proverbs",
    "ecclesiastes": "Ecclesiastes", "the ecclesiastes or preacher": "Ecclesiastes",
    "song of solomon": "Song of Solomon", "song of songs": "Song of Solomon",
    "isaiah": "Isaiah", "jeremiah": "Jeremiah",
    "lamentations": "Lamentations", "the lamentations of jeremiah": "Lamentations",
    "ezekiel": "Ezekiel", "daniel": "Daniel", "hosea": "Hosea", "joel": "Joel",
    "amos": "Amos", "obadiah": "Obadiah", "jonah": "Jonah", "micah": "Micah",
    "nahum": "Nahum", "habakkuk": "Habakkuk", "zephaniah": "Zephaniah",
    "haggai": "Haggai", "zechariah": "Zechariah", "malachi": "Malachi",
    "matthew": "Matthew", "mark": "Mark", "luke": "Luke", "john": "John",
    "acts": "Acts", "romans": "Romans", "galatians": "Galatians",
    "ephesians": "Ephesians", "philippians": "Philippians", "colossians": "Colossians",
    "hebrews": "Hebrews", "james": "James", "jude": "Jude",
    "revelation": "Revelation",
    # KJV long forms
    "the first book of moses: called genesis": "Genesis",
    "the second book of moses: called exodus": "Exodus",
    "the third book of moses: called leviticus": "Leviticus",
    "the fourth book of moses: called numbers": "Numbers",
    "the fifth book of moses: called deuteronomy": "Deuteronomy",
    "the book of josua": "Joshua", "the book of the judges": "Judges",
    "the book of ruth": "Ruth", "the first book of samuel": "1 Samuel",
    "the second book of samuel": "2 Samuel", "the first book of the kings": "1 Kings",
    "the second book of the kings": "2 Kings",
    "the first book of the chronicles": "1 Chronicles",
    "the second book of the chronicles": "2 Chronicles",
    "the book of esdras": "Ezra", "the second book of esdras": "Nehemiah",
    "the book of Esther": "Esther", "the book of job": "Job",
    "the book of psalms": "Psalms", "the book of proverbs": "Proverbs",
    "the book of isaiah": "Isaiah", "the book of jeremiah": "Jeremiah",
    "the book of ezekiel": "Ezekiel", "the book of daniel": "Daniel",
    "the book of hosea": "Hosea", "the book of joel": "Joel",
    "the book of amos": "Amos", "the book of obadiah": "Obadiah",
    "the book of jonah": "Jonah", "the book of micah": "Micah",
    "the book of nahum": "Nahum", "the book of habakkuk": "Habakkuk",
    "the book of zephaniah": "Zephaniah", "the book of haggai": "Haggai",
    "the book of zechariah": "Zechariah", "the book of malachi": "Malachi",
    "the gospel according to matthew": "Matthew",
    "the gospel according to mark": "Mark",
    "the gospel according to luke": "Luke",
    "the gospel according to john": "John",
    "the acts of the apostles": "Acts",
    "epistle of paul the apostle to the romans": "Romans",
    "the epistle of paul the apostle to the corinthians": "1 Corinthians",
    "the second epistle of paul the apostle to the corinthians": "2 Corinthians",
    "the epistle of paul the apostle to the galatians": "Galatians",
    "the epistle of paul the apostle to the ephesians": "Ephesians",
    "the epistle of paul the apostle to the philippians": "Philippians",
    "the epistle of paul the apostle to the colossians": "Colossians",
    "the first epistle of paul the apostle to the thessalonians": "1 Thessalonians",
    "the second epistle of paul the apostle to the thessalonians": "2 Thessalonians",
    "the first epistle of paul to timothy": "1 Timothy",
    "the second epistle of paul to timothy": "2 Timothy",
    "the epistle of paul to titus": "Titus",
    "the epistle of paul to philemon": "Philemon",
    "the epistle of paul the apostle to the hebrews": "Hebrews",
    "the epistle of james": "James",
    "the general epistle of simon peter": "1 Peter",
    "the second general epistle of simon peter": "2 Peter",
    "the epistle of john": "1 John",
    "the second epistle of john": "2 John",
    "the third epistle of john": "3 John",
    "the general epistle of jude": "Jude",
    # WEB alternate names
    "the good news according to matthew": "Matthew",
    "the good news according to mark": "Mark",
    "the good news according to luke": "Luke",
    "the good news according to john": "John",
    "peter's first letter": "1 Peter",
    "peter's second letter": "2 Peter",
    "john's first letter": "1 John",
    "john's second letter": "2 John",
    "john's third letter": "3 John",
    "the letter to the hebrews": "Hebrews",
    "the letter from james": "James",
    "the letter from jude": "Jude",
    "the revelation to john": "Revelation",
    "paul's first letter to the corinthians": "1 Corinthians",
    "paul's second letter to the corinthians": "2 Corinthians",
    "paul's first letter to the thessalonians": "1 Thessalonians",
    "paul's second letter to the thessalonians": "2 Thessalonians",
    "paul's first letter to timothy": "1 Timothy",
    "paul's second letter to timothy": "2 Timothy",
    "paul's letter to titus": "Titus",
    "paul's letter to philemon": "Philemon",
    "paul's letter to the romans": "Romans",
    "paul's letter to the galatians": "Galatians",
    "paul's letter to the ephesians": "Ephesians",
    "paul's letter to the philippians": "Philippians",
    "paul's letter to the colossians": "Colossians",
    "paul's letter to the hebrews": "Hebrews",
}

SKIP_PATTERNS = [
    "project gutenberg", "index", "old testament", "new testament",
    "the old testament", "the new testament", "contents", "table of",
    "preface", "introduction", "acknowledgment", "the king james",
    "the world english bible", "glossary", "world english bible glossary",
    "the full project",
]


def clean_html(text):
    text = re.sub(r'<[^>]+>', ' ', text)
    text = unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def resolve_book(text):
    """Return canonical book name from heading text, or None."""
    clean = re.sub(r'<[^>]+>', '', text).strip()
    low = clean.lower()
    if re.match(r'^psalm\s+\d', low):
        return None
    for pat in SKIP_PATTERNS:
        if low == pat or low.startswith(pat):
            return None
    if low in BOOK_ALIASES:
        return BOOK_ALIASES[low]
    for b in BOOK_ORDER:
        if b.lower() == low:
            return b
    return None


# ======================================== PARSER: GUTENBERG (WEB, KJV) ========================================

def parse_gutenberg(epub_path, name):
    """
    Parse Gutenberg-format EPUB.

    WEB uses <a>Ch:V</a> anchors. KJV uses inline "Ch:V " text markers.
    Headings (h1/h2) mark book boundaries. Content is processed positionally
    so verses between headings get assigned to the correct book.
    """
    print(f"Parsing {name} (Gutenberg)...")
    bible = {}
    z = zipfile.ZipFile(epub_path)
    xhtml_files = sorted([n for n in z.namelist() if n.endswith('.xhtml') and 'h-' in n])

    current_book = None
    verse_format = None  # 'anchor' or 'inline', detected per file

    for fpath in xhtml_files:
        content = z.read(fpath).decode('utf-8', errors='ignore')

        # Detect verse format if not set yet
        if verse_format is None:
            verse_format = 'anchor' if re.search(r'<a[^>]*>\s*\d+:\d+\s*</a>', content[:5000]) else 'inline'

        # Collect headings (h1-h2 only)
        headings = []
        for hm in re.finditer(r'<h[1-2][^>]*>(.*?)</h[1-2]>', content, re.DOTALL):
            book = resolve_book(hm.group(1))
            if book:
                headings.append((hm.start(), book))

        # Collect verse markers
        if verse_format == 'anchor':
            verses = [(m.start(), int(m.group(1)), int(m.group(2)), m)
                      for m in re.finditer(r'<a[^>]*>\s*(\d+):(\d+)\s*</a>', content)]
        else:
            verses = [(m.start(), int(m.group(1)), int(m.group(2)), m)
                      for m in re.finditer(r'(?:^|\n|\s)(\d+):(\d+)\s', content, re.MULTILINE)]

        if not verses:
            # Still update current_book from this file's last heading
            if headings:
                current_book = headings[-1][1]
            continue

        # Merge all events sorted by position
        combined = [(p, 0, b, None, None) for p, b in headings]
        combined += [(p, 1, ch, vs, vm) for p, ch, vs, vm in verses]
        combined.sort(key=lambda e: e[0])

        # Process positionally
        file_book = current_book
        pending = []  # (ch, vs, vm)

        for ev in combined:
            if ev[1] == 0:
                # Heading: flush pending verses for previous book, then switch
                if pending and file_book:
                    _extract(content, pending, file_book, bible)
                    pending = []
                file_book = ev[2]
            else:
                pending.append((ev[2], ev[3], ev[4]))

        # Final flush for this file
        if pending and file_book:
            _extract(content, pending, file_book, bible)

        # Update global current_book to the last resolved heading in this file
        if headings:
            current_book = headings[-1][1]

    chapters = sum(len(ch) for ch in bible.values())
    verses = sum(len(v) for ch in bible.values() for v in ch.values())
    print(f"    {name}: {chapters} chapters, ~{verses} verses")
    return bible


def _extract(content, pending, book, bible):
    """Extract verse text from a list of match objects."""
    if book not in bible:
        bible[book] = {}
    for i, (ch, vs, vm) in enumerate(pending):
        text_end = pending[i + 1][2].start() if i + 1 < len(pending) else len(content)
        text = clean_html(content[vm.end():text_end])
        if text:
            if ch not in bible[book]:
                bible[book][ch] = {}
            bible[book][ch][vs] = text


# ======================================== PARSER: NET ========================================

def parse_net(epub_path):
    print("Parsing NET...")
    bible = {}
    z = zipfile.ZipFile(epub_path)
    xhtml_files = sorted([n for n in z.namelist() if n.endswith('.xhtml') and '_notes' not in n])

    for fpath in xhtml_files:
        content = z.read(fpath).decode('utf-8', errors='ignore')
        title_match = re.search(r'<title>(.*?)</title>', content)
        if not title_match:
            continue
        title = title_match.group(1).strip()

        book_name = None
        ch_num = None

        tm = re.match(r'NET Bible.*?\b(.+?)\s+(\d+)\s*$', title)
        if tm:
            raw_book = tm.group(1).strip()
            book_name = resolve_book(raw_book)
            if book_name:
                ch_num = int(tm.group(2))

        if book_name is None:
            h1m = re.search(r'<h1[^>]*>(.*?)</h1>', content, re.DOTALL)
            if h1m:
                h1text = clean_html(h1m.group(1))
                hm = re.match(r'(.+?)\s*(?:Chapter\s*)?(\d+)', h1text, re.IGNORECASE)
                if hm:
                    raw_book = hm.group(1).strip()
                    book_name = resolve_book(raw_book)
                    if book_name:
                        ch_num = int(hm.group(2))

        if not book_name or not ch_num:
            continue
        if ch_num > CHAPTER_COUNTS.get(book_name, 999):
            continue

        verse_spans = list(re.finditer(
            r'<span[^>]*class="[^"]*verse[^"]*"[^>]*>\s*(\d+):(\d+)\s*</span>', content))
        if not verse_spans:
            continue

        if book_name not in bible:
            bible[book_name] = {}
        if ch_num not in bible[book_name]:
            bible[book_name][ch_num] = {}

        for i, vs in enumerate(verse_spans):
            v_num = int(vs.group(2))
            text_end = verse_spans[i + 1].start() if i + 1 < len(verse_spans) else len(content)
            text = clean_html(content[vs.end():text_end])
            if text:
                bible[book_name][ch_num][v_num] = text

    chapters = sum(len(ch) for ch in bible.values())
    print(f"    NET: {chapters} chapters")
    return bible


# ======================================== PARSER: BSB ========================================

def parse_bsb(epub_path):
    print("Parsing BSB...")
    bible = {}
    z = zipfile.ZipFile(epub_path)
    opf = z.read('content.opf').decode('utf-8', errors='ignore')

    text_items = re.findall(r'<item[^>]*id="(\d+)"[^>]*href="(.*?\.htm)"', opf)
    if not text_items:
        text_items = re.findall(r'<item[^>]*href="(.*?\.htm)"[^>]*id="(\d+)"', opf)
        text_items = [(t[1], t[0]) for t in text_items]
    text_items.sort(key=lambda x: int(x[0]))

    for item_id, fpath in text_items:
        try:
            content = z.read(fpath).decode('utf-8', errors='ignore')
        except Exception:
            continue

        title_match = re.search(r'<title>(.+?)\s+(?:BSB|Study Bible)</title>', content)
        if not title_match:
            continue

        ch_match = re.match(r'(.+?)\s+(\d+)\s*$', title_match.group(1).strip())
        if not ch_match:
            continue

        book_name = resolve_book(ch_match.group(1).strip())
        ch_num = int(ch_match.group(2))
        if not book_name or ch_num > CHAPTER_COUNTS.get(book_name, 999):
            continue

        verse_spans = list(re.finditer(
            r'<span[^>]*class="[^"]*reftext[^"]*"[^>]*>(\d+)</span>', content))
        if not verse_spans:
            continue

        if book_name not in bible:
            bible[book_name] = {}
        if ch_num not in bible[book_name]:
            bible[book_name][ch_num] = {}

        for i, vs in enumerate(verse_spans):
            v_num = int(vs.group(1))
            text_end = verse_spans[i + 1].start() if i + 1 < len(verse_spans) else len(content)
            text = clean_html(content[vs.end():text_end])
            if text:
                bible[book_name][ch_num][v_num] = text

    chapters = sum(len(ch) for ch in bible.values())
    print(f"    BSB: {chapters} chapters")
    return bible


# ======================================== FORMAT & VALIDATE ========================================

def format_data(bible_data):
    result = {}
    for book in BOOK_ORDER:
        result[book] = {}
        chapters = bible_data.get(book, {})
        for ch_num in sorted(chapters.keys()):
            result[book][str(ch_num)] = {}
            for v_num in sorted(chapters[ch_num].keys()):
                result[book][str(ch_num)][str(v_num)] = chapters[ch_num][v_num]
    return result


def validate(data, name):
    total_ch = 0
    missing = 0
    for book, expected in CHAPTER_COUNTS.items():
        chapters = data.get(book, {})
        if not chapters:
            missing += 1
            continue
        actual = max(map(int, chapters.keys()))
        total_ch += actual
        if actual < expected:
            print(f"    {book}: {actual}/{expected} chapters")
    print(f"    {name}: {total_ch} chapters, {missing} books missing")


# ======================================== MAIN ========================================

if __name__ == "__main__":
    print("Bible EPUB Extractor")
    print("=" * 50)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    bibles = {}

    web_path = os.path.join(BIBLES_DIR, "WEB.epub")
    if os.path.exists(web_path):
        bibles["WEB"] = format_data(parse_gutenberg(web_path, "WEB"))

    kjv_path = os.path.join(BIBLES_DIR, "kjv.epub")
    if os.path.exists(kjv_path):
        bibles["KJV"] = format_data(parse_gutenberg(kjv_path, "KJV"))

    net_path = os.path.join(BIBLES_DIR, "NETfree.epub")
    if os.path.exists(net_path):
        bibles["NET"] = format_data(parse_net(net_path))

    bsb_path = os.path.join(BIBLES_DIR, "bsb.epub")
    if os.path.exists(bsb_path):
        bibles["BSB"] = format_data(parse_bsb(bsb_path))

    output_files = []
    for version, data in bibles.items():
        out_path = os.path.join(OUTPUT_DIR, f"bible-{version.lower()}.json")
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        size_mb = os.path.getsize(out_path) / (1024 * 1024)
        output_files.append((version, out_path, size_mb))
        print(f"  {os.path.basename(out_path)} ({size_mb:.1f} MB)")

    print("\nValidation:")
    for version, data in bibles.items():
        validate(data, version)

    # Index
    version_names = {
        "WEB": "World English Bible", "BSB": "Berean Standard Bible",
        "NET": "New English Translation", "KJV": "King James Version"
    }
    index = {"versions": {}}
    for version, path, size_mb in output_files:
        index["versions"][version] = {
            "name": version_names.get(version, version),
            "file": f"data/bible-{version.lower()}.json",
            "sizeMB": round(size_mb, 1)
        }
    with open(os.path.join(OUTPUT_DIR, "bibles.json"), 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2, ensure_ascii=False)

    print(f"\nIndex: data/bibles.json ({len(bibles)} versions)")