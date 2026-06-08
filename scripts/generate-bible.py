#!/usr/bin/env python3
"""
Fetches the World English Bible (WEB) and generates a JSON file
with structure: { "Book": { "chapter_num": { "verse_num": "verse_text" } } }
Uses the public bible-api.com which serves WEB text.
"""

import json
import sys
import urllib.request
import urllib.error
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

BOOKS = {
    "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36, "Deuteronomy": 34,
    "Joshua": 24, "Judges": 21, "Ruth": 4, "1 Samuel": 31, "2 Samuel": 24,
    "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29, "2 Chronicles": 36,
    "Ezra": 10, "Nehemiah": 13, "Esther": 10,
    "Job": 42, "Psalms": 150, "Proverbs": 31, "Ecclesiastes": 12, "Song of Solomon": 8,
    "Isaiah": 66, "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12,
    "Hosea": 14, "Joel": 3, "Amos": 9, "Obadiah": 1, "Jonah": 4, "Micah": 7,
    "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3, "Haggai": 2, "Zechariah": 14, "Malachi": 4,
    "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, "Acts": 28,
    "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13, "Galatians": 6,
    "Ephesians": 6, "Philippians": 4, "Colossians": 4,
    "1 Thessalonians": 5, "2 Thessalonians": 3,
    "1 Timothy": 6, "2 Timothy": 4, "Titus": 3, "Philemon": 1, "Hebrews": 13,
    "James": 5, "1 Peter": 5, "2 Peter": 3,
    "1 John": 5, "2 John": 1, "3 John": 1, "Jude": 1, "Revelation": 22
}

def fetch_chapter(book, chapter):
    """Fetch a single chapter and return verse dict."""
    query = f"{book} {chapter}"
    encoded = urllib.parse.quote(query)
    url = f"https://bible-api.com/{encoded}?translation=web"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status != 200:
                return chapter, None
            data = json.loads(resp.read().decode("utf-8"))
            verses = {}
            for v in data.get("verses", []):
                verses[str(v["verse"])] = v["text"].strip()
            return chapter, verses
    except Exception as e:
        return chapter, f"ERROR: {e}"

def generate_bible(output_path):
    bible = {}
    total = sum(BOOKS.values())
    completed = 0

    tasks = []
    for book, max_ch in BOOKS.items():
        for ch in range(1, max_ch + 1):
            tasks.append((book, ch))

    print(f"Fetching {total} chapters from bible-api.com (WEB)...")
    print(f"This will take several minutes. Be patient.")

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {}
        for book, ch in tasks:
            future = executor.submit(fetch_chapter, book, ch)
            futures[future] = (book, ch)

        for future in as_completed(futures):
            book, ch_num = futures[future]
            chapter_num, verses = future.result()
            completed += 1

            if isinstance(verses, str):
                print(f"  [{completed}/{total}] {book} {chapter_num}: {verses}")
            elif verses:
                if book not in bible:
                    bible[book] = {}
                bible[book][str(chapter_num)] = verses

                if completed % 50 == 0 or completed == total:
                    print(f"  [{completed}/{total}] {book} {chapter_num}: {len(verses)} verses")
            else:
                print(f"  [{completed}/{total}] {book} {chapter_num}: No data")

    # Write output preserving book order (OT first, NT second)
    ordered_books = list(BOOKS.keys())
    ordered_bible = {}
    for book in ordered_books:
        if book in bible:
            ordered_bible[book] = bible[book]

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(ordered_bible, f, ensure_ascii=False, separators=(",", ":"))

    total_verses = sum(
        sum(len(ch) for ch in book.values())
        for book in bible.values()
    )
    file_size = len(json.dumps(ordered_bible, ensure_ascii=False, separators=(",", ":")))
    print(f"\nDone! Wrote {total_verses} verses to {output_path}")
    print(f"File size: ~{file_size / 1024 / 1024:.1f} MB")

if __name__ == "__main__":
    output = sys.argv[1] if len(sys.argv) > 1 else "bible-web.json"
    generate_bible(output)
