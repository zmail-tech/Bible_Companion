#!/usr/bin/env python3
"""Demo script showing English concordance usage."""

import json
from pathlib import Path


def load_concordance(concordance_path: Path) -> dict:
    """Load the English concordance from JSON file."""
    with open(concordance_path, encoding="utf-8") as f:
        return json.load(f)


def load_concordance_streaming(concordance_path: Path):
    """Load the English concordance from JSONL file (streaming)."""
    with open(concordance_path, encoding="utf-8") as f:
        for line in f:
            yield json.loads(line)


def search_word(concordance: dict, word: str) -> list[str]:
    """Search for a word in the concordance (case-sensitive)."""
    return concordance.get(word, [])


def search_word_case_insensitive(concordance: dict, word: str) -> dict[str, list[str]]:
    """Search for a word in the concordance (case-insensitive)."""
    results = {}
    word_lower = word.lower()
    for key, verses in concordance.items():
        if key.lower() == word_lower:
            results[key] = verses
    return results


def get_statistics(stats_path: Path) -> dict:
    """Load concordance statistics."""
    with open(stats_path, encoding="utf-8") as f:
        return json.load(f)


def main():
    """Demonstrate English concordance usage."""
    # Paths
    output_dir = Path(__file__).parent.parent / "output" / "base" / "english-concordance"
    json_path = output_dir / "words-to-verses.json"
    jsonl_path = output_dir / "words-to-verses.jsonl"
    stats_path = output_dir / "stats.json"

    print("=" * 70)
    print("BSB English Concordance Demo")
    print("=" * 70)
    print()

    # Check if files exist
    if not json_path.exists():
        print("ERROR: English concordance not built yet.")
        print("Run: python3 -m scripts.build --english-concordance")
        return

    # Load statistics
    print("Loading statistics...")
    stats = get_statistics(stats_path)
    print(f"  Total entries: {stats['total_entries']:,}")
    print(f"  Total verse references: {stats['total_verse_references']:,}")
    print(f"  Average verses per entry: {stats['avg_verses_per_entry']}")
    print()

    # Show most frequent words
    print("Top 10 Most Frequent Words:")
    for i, item in enumerate(stats["most_frequent_words"][:10], 1):
        print(f"  {i:2}. {item['word']:15} {item['occurrences']:,} occurrences")
    print()

    # Load concordance
    print("Loading concordance...")
    concordance = load_concordance(json_path)
    print(f"  Loaded {len(concordance):,} entries")
    print()

    # Example 1: Search for specific words
    print("-" * 70)
    print("Example 1: Searching for Specific Words")
    print("-" * 70)

    search_words = ["Jesus", "Moses", "David", "Paul", "love", "faith"]
    for word in search_words:
        verses = search_word(concordance, word)
        if verses:
            print(f"{word}: {len(verses)} occurrences")
            print(f"  First occurrence: {verses[0]}")
            print(f"  Last occurrence: {verses[-1]}")
        else:
            print(f"{word}: Not found")
        print()

    # Example 2: Case-insensitive search
    print("-" * 70)
    print("Example 2: Case-Insensitive Search (word: 'god')")
    print("-" * 70)

    results = search_word_case_insensitive(concordance, "god")
    for variant, verses in results.items():
        print(f"  {variant}: {len(verses)} occurrences")
        print(f"    First 3: {verses[:3]}")
    print()

    # Example 3: Find words by pattern
    print("-" * 70)
    print("Example 3: Words Starting with 'Abra'")
    print("-" * 70)

    matching_words = [word for word in concordance.keys() if word.startswith("Abra")]
    for word in sorted(matching_words):
        count = len(concordance[word])
        print(f"  {word}: {count} occurrences")
    print()

    # Example 4: Streaming JSONL (memory efficient)
    print("-" * 70)
    print("Example 4: Streaming JSONL (first 10 entries)")
    print("-" * 70)

    for i, entry in enumerate(load_concordance_streaming(jsonl_path)):
        if i >= 10:
            break
        word = entry["word"]
        count = len(entry["verses"])
        first_verse = entry["verses"][0] if entry["verses"] else "N/A"
        print(f"  {word}: {count} occurrences (first: {first_verse})")
    print()

    # Example 5: Compare related words
    print("-" * 70)
    print("Example 5: Comparing Related Words")
    print("-" * 70)

    word_groups = [
        ["love", "Love", "loved", "loves", "loving"],
        ["faith", "Faith", "faithful", "faithfulness"],
        ["grace", "Grace", "gracious"],
    ]

    for group in word_groups:
        print(f"Word group: {group[0]}*")
        total = 0
        for word in group:
            verses = search_word(concordance, word)
            if verses:
                count = len(verses)
                total += count
                print(f"  {word:20} {count:5,} occurrences")
        print(f"  {'TOTAL':20} {total:5,} occurrences")
        print()

    # Example 6: Number entries
    print("-" * 70)
    print("Example 6: Number Entries (sample)")
    print("-" * 70)

    number_entries = [word for word in concordance.keys() if word[0].isdigit()]
    print(f"Total number entries: {len(number_entries)}")
    print("\nSample numbers:")
    for word in sorted(number_entries)[:15]:
        count = len(concordance[word])
        verses = concordance[word][:3]
        print(f"  {word:15} {count:3} occurrences - {verses}")
    print()

    # Example 7: Find verses containing multiple words
    print("-" * 70)
    print("Example 7: Verses Containing Multiple Words")
    print("-" * 70)

    words_to_find = ["love", "God"]
    print(f"Finding verses containing: {', '.join(words_to_find)}")

    # Get all verses for each word
    verse_sets = []
    for word in words_to_find:
        verses = search_word(concordance, word)
        if verses:
            verse_sets.append(set(verses))
        else:
            print(f"  '{word}' not found")
            break
    else:
        # Find intersection
        common_verses = verse_sets[0].intersection(*verse_sets[1:])
        print(f"  Found {len(common_verses)} verses")
        print(f"  First 10: {sorted(common_verses)[:10]}")
    print()

    print("=" * 70)
    print("Demo Complete!")
    print("=" * 70)


if __name__ == "__main__":
    main()
