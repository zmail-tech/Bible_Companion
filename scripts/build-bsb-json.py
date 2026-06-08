#!/usr/bin/env python3
"""Build BSB Strong's JSON from USJ source files and text-only files.

Hybrid approach:
- USJ files: headings, paragraph grouping, word-level Strong's in English word order
- Text-only files: authoritative English verse text with correct formatting

This gives us correct English text with proper spacing AND Strong's numbers
in the right positions.
"""

import json
import os
import sys
import re
from collections import defaultdict

ABBREV_MAP = {
    "GEN": "Genesis", "EXO": "Exodus", "LEV": "Leviticus", "NUM": "Numbers",
    "DEU": "Deuteronomy", "JOS": "Joshua", "JDG": "Judges", "RUT": "Ruth",
    "1SA": "1 Samuel", "2SA": "2 Samuel", "1KI": "1 Kings", "2KI": "2 Kings",
    "1CH": "1 Chronicles", "2CH": "2 Chronicles", "EZR": "Ezra", "NEH": "Nehemiah",
    "EST": "Esther", "JOB": "Job", "PSA": "Psalms", "PRO": "Proverbs",
    "ECC": "Ecclesiastes", "SNG": "Song of Solomon", "ISA": "Isaiah",
    "JER": "Jeremiah", "LAM": "Lamentations", "EZK": "Ezekiel", "DAN": "Daniel",
    "HOS": "Hosea", "JOL": "Joel", "AMO": "Amos", "OBA": "Obadiah",
    "JON": "Jonah", "MIC": "Micah", "NAM": "Nahum", "HAB": "Habakkuk",
    "ZEP": "Zephaniah", "HAG": "Haggai", "ZEC": "Zechariah", "MAL": "Malachi",
    "MAT": "Matthew", "MRK": "Mark", "LUK": "Luke", "JHN": "John", "ACT": "Acts",
    "ROM": "Romans", "1CO": "1 Corinthians", "2CO": "2 Corinthians",
    "GAL": "Galatians", "EPH": "Ephesians", "PHP": "Philippians", "COL": "Colossians",
    "1TH": "1 Thessalonians", "2TH": "2 Thessalonians", "1TI": "1 Timothy",
    "2TI": "2 Timothy", "TIT": "Titus", "PHM": "Philemon", "HEB": "Hebrews",
    "JAS": "James", "1PE": "1 Peter", "2PE": "2 Peter", "1JN": "1 John",
    "2JN": "2 John", "3JN": "3 John", "JUD": "Jude", "REV": "Revelation",
}

FULL_TO_ABBREV = {v: k for k, v in ABBREV_MAP.items()}

USJ_FILES = {
    "GEN": "01GENBSB_full_strongs.usj", "EXO": "02EXOBSB_full_strongs.usj",
    "LEV": "03LEVBSB_full_strongs.usj", "NUM": "04NUMBSB_full_strongs.usj",
    "DEU": "05DEUBSB_full_strongs.usj", "JOS": "06JOSBSB_full_strongs.usj",
    "JDG": "07JDGBSB_full_strongs.usj", "RUT": "08RUTBSB_full_strongs.usj",
    "1SA": "091SABSB_full_strongs.usj", "2SA": "102SABSB_full_strongs.usj",
    "1KI": "111KIBSB_full_strongs.usj", "2KI": "122KIBSB_full_strongs.usj",
    "1CH": "131CHBSB_full_strongs.usj", "2CH": "142CHBSB_full_strongs.usj",
    "EZR": "15EZRBSB_full_strongs.usj", "NEH": "16NEHBSB_full_strongs.usj",
    "EST": "17ESTBSB_full_strongs.usj", "JOB": "18JOBBSB_full_strongs.usj",
    "PSA": "19PSABSB_full_strongs.usj", "PRO": "20PROBSB_full_strongs.usj",
    "ECC": "21ECCBSB_full_strongs.usj", "SNG": "22SNGBSB_full_strongs.usj",
    "ISA": "23ISABSB_full_strongs.usj", "JER": "24JERBSB_full_strongs.usj",
    "LAM": "25LAMBSB_full_strongs.usj", "EZK": "26EZKBSB_full_strongs.usj",
    "DAN": "27DANBSB_full_strongs.usj", "HOS": "28HOSBSB_full_strongs.usj",
    "JOL": "29JOLBSB_full_strongs.usj", "AMO": "30AMOBSB_full_strongs.usj",
    "OBA": "31OBABSB_full_strongs.usj", "JON": "32JONBSB_full_strongs.usj",
    "MIC": "33MICBSB_full_strongs.usj", "NAM": "34NAMBSB_full_strongs.usj",
    "HAB": "35HABBSB_full_strongs.usj", "ZEP": "36ZEPBSB_full_strongs.usj",
    "HAG": "37HAGBSB_full_strongs.usj", "ZEC": "38ZECBSB_full_strongs.usj",
    "MAL": "39MALBSB_full_strongs.usj", "MAT": "41MATBSB_full_strongs.usj",
    "MRK": "42MRKBSB_full_strongs.usj", "LUK": "43LUKBSB_full_strongs.usj",
    "JHN": "44JHNBSB_full_strongs.usj", "ACT": "45ACTBSB_full_strongs.usj",
    "ROM": "46ROMBSB_full_strongs.usj", "1CO": "471COBSB_full_strongs.usj",
    "2CO": "482COBSB_full_strongs.usj", "GAL": "49GALBSB_full_strongs.usj",
    "EPH": "50EPHBSB_full_strongs.usj", "PHP": "51PHPBSB_full_strongs.usj",
    "COL": "52COLBSB_full_strongs.usj", "1TH": "531THBSB_full_strongs.usj",
    "2TH": "542THBSB_full_strongs.usj", "1TI": "551TIBSB_full_strongs.usj",
    "2TI": "562TIBSB_full_strongs.usj", "TIT": "57TITBSB_full_strongs.usj",
    "PHM": "58PHMBSB_full_strongs.usj", "HEB": "59HEBBSB_full_strongs.usj",
    "JAS": "60JASBSB_full_strongs.usj", "1PE": "611PEBSB_full_strongs.usj",
    "2PE": "622PEBSB_full_strongs.usj", "1JN": "631JNBSB_full_strongs.usj",
    "2JN": "642JNBSB_full_strongs.usj", "3JN": "653JNBSB_full_strongs.usj",
    "JUD": "66JUDBSB_full_strongs.usj", "REV": "67REVBSB_full_strongs.usj",
}

HEADING_MARKERS = {"s1", "s2", "s3", "s4", "s5", "ms1", "ms2"}
CONTENT_PARA_MARKERS = {"p", "pmo", "pm", "mrpo", "mq1", "mq2", "b", "mst",
                        "q", "q1", "q2", "q1m", "q2m", "qh", "rpl", "sls",
                        "li1", "li2", "d"}


def extract_text_from_content(content):
    """Extract plain text from a USJ content array."""
    text = ""
    for item in content:
        if isinstance(item, str):
            text += item
        elif isinstance(item, dict) and "content" in item:
            text += extract_text_from_content(item["content"])
    return text


def parse_text_only_files(text_only_dir):
    """Parse text-only files for authoritative English verse text.
    
    Returns: {(book_name, chapter, verse): text}
    """
    verse_text = {}
    
    for filename in os.listdir(text_only_dir):
        if not filename.endswith('_BSB.txt'):
            continue
        
        parts = filename.replace('_BSB.txt', '').split('_')
        if len(parts) < 2:
            continue
        
        abbrev = parts[0]
        try:
            chapter = int(parts[1])
        except ValueError:
            continue
        
        book_name = ABBREV_MAP.get(abbrev)
        if not book_name:
            continue
        
        filepath = os.path.join(text_only_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        for verse_num, line in enumerate(lines, start=1):
            verse_text[(book_name, chapter, verse_num)] = line.strip()
    
    return verse_text


def parse_usj(usj_path, book_name):
    """Parse a USJ file to extract headings, paragraphs, and Strong's numbers.
    
    Returns: {chapter: [(type, data), ...]}
    """
    with open(usj_path, 'r', encoding='utf-8') as f:
        usj = json.load(f)

    chapters = defaultdict(list)
    current_chapter = 0
    paragraph_num = 0
    
    # Collect words and headings per verse
    def process_content(content):
        nonlocal current_chapter, paragraph_num
        
        for item in content:
            if not isinstance(item, dict):
                continue
            
            item_type = item.get("type")
            marker = item.get("marker", "")
            
            if item_type == "chapter":
                # Save any pending verse from previous chapter BEFORE updating
                # current_chapter, so the verse is saved to the correct chapter
                if current_chapter > 0 and state["verse_num"] > 0:
                    save_verse()
                    state["verse_num"] = 0
                    state["words"] = []
                current_chapter = int(item.get("number", 0))
                paragraph_num = 0
                
            elif item_type == "para":
                if marker in HEADING_MARKERS and current_chapter > 0:
                    heading_text = extract_text_from_content(item.get("content", []))
                    if heading_text:
                        chapters[current_chapter].append({
                            "type": "heading",
                            "level": marker,
                            "text": heading_text,
                        })
                elif marker in CONTENT_PARA_MARKERS:
                    paragraph_num += 1
                    process_para_content(item.get("content", []))
                    
            elif "content" in item and item_type != "char":
                process_content(item["content"])

    # Shared mutable state for nested processing
    state = {
        "verse_num": 0,
        "words": [],
    }

    def save_verse():
        """Save current verse if it has content."""
        if state["verse_num"] > 0 and state["words"]:
            final_words = clean_verse_words(state["words"])
            if final_words:
                chapters[current_chapter].append({
                    "type": "verse",
                    "number": state["verse_num"],
                    "words": final_words,
                    "paragraph": paragraph_num,
                })

    def add_word(strongs, text):
        """Add a word entry if valid."""
        text_stripped = text.strip()
        if text_stripped and text_stripped not in ("-", ". . ."):
            state["words"].append({
                "text": text,
                "strongs": strongs if strongs else None,
            })

    def add_plain_text(s):
        """Append plain text to last word."""
        if state["words"] and (s.strip() or s == " "):
            state["words"][-1]["text"] += s

    def add_char(strongs, text):
        """Process a char word element."""
        text_stripped = text.strip()
        if text_stripped and text_stripped not in ("-", ". . ."):
            state["words"].append({
                "text": text,
                "strongs": strongs if strongs else None,
            })

    def process_para_content(content):
        """Process paragraph content recursively. Only saves verses when hitting
        a new verse marker or chapter boundary — not at end of each block."""
        
        for item in content:
            if not isinstance(item, dict):
                add_plain_text(item)
                continue
            
            item_type = item.get("type")
            
            if item_type == "verse":
                # Only save if this is a DIFFERENT verse number from what we're
                # already tracking (avoids duplicate saves from recursion)
                if state["verse_num"] > 0 and state["verse_num"] != int(item.get("number", 0)):
                    save_verse()
                state["verse_num"] = int(item.get("number", 0))
                state["words"] = []
                
            elif item_type == "char":
                marker = item.get("marker", "")
                if marker == "w":
                    strongs = item.get("strong", "")
                    word_text = extract_text_from_content(item.get("content", []))
                    add_word(strongs, word_text)
                elif "content" in item:
                    process_para_content(item.get("content", []))
            elif "content" in item:
                process_para_content(item["content"])

    process_content(usj.get("content", []))
    # Save the very last verse in the book
    save_verse()
    state["verse_num"] = 0
    state["words"] = []
    
    return dict(chapters)


def clean_verse_words(words):
    """Clean and merge adjacent words into readable text."""
    # Merge words that need to be joined
    merged = []
    for w in words:
        text = w["text"].strip()
        strongs = w["strongs"]
        if not text:
            continue
        merged.append({"text": text, "strongs": strongs})
    return merged


def merge_strongs_into_text(verse_text, usj_chapters):
    """Build final Bible JSON combining text-only text with USJ structure.
    
    For each verse:
    - Use text-only file for authoritative English text
    - Use USJ for Strong's numbers, headings, and paragraph grouping
    """
    bible = {}
    
    processed_books = set()
    
    for abbrev, usj_data in usj_chapters.items():
        book_name = ABBREV_MAP.get(abbrev)
        if not book_name or book_name in processed_books:
            continue
        processed_books.add(book_name)
        
        bible[book_name] = {}
        
        for chapter_num, items in sorted(usj_data.items()):
            items_list = []
            current_paragraph = None  # Track paragraph groups
            
            for item in items:
                if item["type"] == "heading":
                    # Check if there's a paragraph break between this heading
                    # and the last verse
                    if current_paragraph is not None:
                        current_paragraph = None  # Reset - heading starts new group
                    
                    items_list.append({
                        "type": "heading",
                        "level": item["level"],
                        "text": item["text"],
                    })
                    
                elif item["type"] == "verse":
                    verse_num = item["number"]
                    strongs_words = item.get("words", [])
                    para = item.get("paragraph")
                    
                    # Get authoritative text from text-only files
                    text = verse_text.get((book_name, chapter_num, verse_num), "")
                    
                    # Build words array with Strong's data from USJ
                    # These words are in English word order (from USJ parsing)
                    words_data = []
                    for w in strongs_words:
                        # Clean up text - remove extra spaces
                        wtext = " ".join(w["text"].split()).strip()
                        if wtext:
                            words_data.append({
                                "text": wtext,
                                "strongs": w["strongs"],
                            })
                    
                    verse_obj = {
                        "type": "verse",
                        "number": verse_num,
                        "text": text,
                        "words": words_data,
                        "paragraph": para,
                    }
                    
                    # Check for paragraph break
                    if current_paragraph is not None and para != current_paragraph:
                        # Paragraph break between verses
                        verse_obj["paragraph_break"] = True
                    current_paragraph = para
                    
                    items_list.append(verse_obj)
            
            if items_list:
                bible[book_name][chapter_num] = items_list
    
    return bible


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    usj_dir = os.path.join(project_root, 'bsb-data', 'sources', 'bsb-usj',
                           'results_usj', 'strongs_full')
    text_only_dir = os.path.join(project_root, 'bsb-data', 'output', 'base', 'text-only')
    headings_path = os.path.join(project_root, 'bsb-data', 'output', 'base', 'headings.jsonl')
    output_path = os.path.join(project_root, 'data', 'bsb-strongs.json')
    
    for name, path in [("USJ", usj_dir), ("Text-only", text_only_dir)]:
        if not os.path.isdir(path):
            print(f"Error: {name} directory not found: {path}", file=sys.stderr)
            sys.exit(1)
    
    # 1. Load text-only files (authoritative English text)
    print("Loading text-only files...")
    verse_text = parse_text_only_files(text_only_dir)
    print(f"  Loaded {len(verse_text)} verses")
    
    # 2. Parse USJ files (headings, paragraphs, Strong's in English word order)
    print("Parsing USJ files...")
    all_usj = {}
    for abbrev in sorted(USJ_FILES.keys()):
        usj_filename = USJ_FILES[abbrev]
        usj_path = os.path.join(usj_dir, usj_filename)
        book_name = ABBREV_MAP.get(abbrev)
        if not book_name:
            continue
        
        if not os.path.exists(usj_path):
            print(f"  Warning: USJ not found: {usj_filename}", file=sys.stderr)
            continue
        
        print(f"  {abbrev} ({book_name})...", file=sys.stderr)
        chapters = parse_usj(usj_path, book_name)
        all_usj[abbrev] = chapters
    
    # 3. Merge text with USJ structure
    print("Building final JSON structure...")
    bible = merge_strongs_into_text(verse_text, all_usj)
    
    # 4. Also load headings index (if available) to enhance heading data
    if os.path.exists(headings_path):
        print("Loading headings index...", file=sys.stderr)
        # Store headings as a separate section in the JSON
        headings = []
        with open(headings_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    headings.append(json.loads(line))
        # We'll attach reference headings inline via "refs" data
        # Build lookup: (book_code, chapter, verse) -> [heading objects]
        heading_lookup = defaultdict(list)
        for h in headings:
            # Use abbreviation code from heading
            book_key = h.get("b", "")
            if book_key:
                heading_lookup[(book_key, h["c"], h["before_v"])].append(h)
        
        # Attach reference headings to verses
        for book_name, chapters in bible.items():
            abbrev = FULL_TO_ABBREV.get(book_name)
            if not abbrev:
                continue
            for ch_num, items in chapters.items():
                for item in items:
                    if item["type"] == "verse":
                        refs = heading_lookup.get((abbrev, ch_num, item["number"]), [])
                        # Add reference type headings
                        for ref in refs:
                            if ref["level"] == "r":
                                item.setdefault("refs", []).append(ref)
    
    # 5. Print stats
    total_books = len(bible)
    total_chapters = 0
    total_verses = 0
    total_headings = 0
    total_words = 0
    
    for book, chapters in bible.items():
        for ch_num, items in chapters.items():
            total_chapters += 1
            for item in items:
                if item["type"] == "verse":
                    total_verses += 1
                    total_words += len(item.get("words", []))
                elif item["type"] == "heading":
                    total_headings += 1
    
    print(f"\nBooks: {total_books}")
    print(f"Chapters: {total_chapters}")
    print(f"Verses: {total_verses}")
    print(f"Headings: {total_headings}")
    print(f"Word entries (Strong's): {total_words}")
    
    # 6. Write output
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(bible, f, ensure_ascii=False, separators=(',', ':'))
    
    file_size = os.path.getsize(output_path)
    print(f"\nOutput: {output_path}")
    print(f"File size: {file_size / (1024 * 1024):.2f} MB")


if __name__ == '__main__':
    main()
