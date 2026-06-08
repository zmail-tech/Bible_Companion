#!/usr/bin/env python3
"""Single-threaded WEB Bible fetcher with rate limiting."""
import json, sys, urllib.request, urllib.parse, urllib.error, time

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

def fetch_chapter(book, chapter, retries=3):
    query = f"{book} {chapter}"
    encoded = urllib.parse.quote(query)
    url = f"https://bible-api.com/{encoded}?translation=web"
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                verses = {}
                for v in data.get("verses", []):
                    verses[str(v["verse"])] = v["text"].strip()
                return verses
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = (attempt + 1) * 5
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
            else:
                return None
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2)
            else:
                return None
    return None

def main():
    output = sys.argv[1] if len(sys.argv) > 1 else "bible-web.json"
    bible = {}
    total = sum(BOOKS.values())
    count = 0

    for book, max_ch in BOOKS.items():
        print(f"Fetching {book} ({max_ch} chapters)...", flush=True)
        bible[book] = {}
        for ch in range(1, max_ch + 1):
            count += 1
            verses = fetch_chapter(book, ch)
            if verses:
                bible[book][str(ch)] = verses
            else:
                print(f"  WARNING: Failed {book} {ch}", flush=True)

            if ch % 20 == 0 or ch == max_ch:
                print(f"  ... {ch}/{max_ch}", flush=True)
            time.sleep(0.35)

    with open(output, "w", encoding="utf-8") as f:
        json.dump(bible, f, ensure_ascii=False, separators=(",", ":"))

    total_verses = sum(sum(len(ch) for ch in book.values()) for book in bible.values())
    print(f"\nDone! {total_verses} verses written to {output}", flush=True)

if __name__ == "__main__":
    main()
