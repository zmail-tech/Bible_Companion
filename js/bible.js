// Bible data loader and navigation logic

const OLD_TESTAMENT = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther",
  "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon",
  "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel",
  "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
];

const NEW_TESTAMENT = [
  "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
  "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
  "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

const BOOK_ORDER = [...OLD_TESTAMENT, ...NEW_TESTAMENT];

const CHAPER_PER_BOOK = {
  "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36, "Deuteronomy": 34,
  "Joshua": 24, "Judges": 21, "Ruth": 4, "1 Samuel": 31, "2 Samuel": 24,
  "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29, "2 Chronicles": 36, "Ezra": 10, "Nehemiah": 13, "Esther": 10,
  "Job": 42, "Psalms": 150, "Proverbs": 31, "Ecclesiastes": 12, "Song of Solomon": 8,
  "Isaiah": 66, "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12,
  "Hosea": 14, "Joel": 3, "Amos": 9, "Obadiah": 1, "Jonah": 4, "Micah": 7, "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3, "Haggai": 2, "Zechariah": 14, "Malachi": 4,
  "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, "Acts": 28,
  "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13, "Galatians": 6, "Ephesians": 6,
  "Philippians": 4, "Colossians": 4, "1 Thessalonians": 5, "2 Thessalonians": 3,
  "1 Timothy": 6, "2 Timothy": 4, "Titus": 3, "Philemon": 1, "Hebrews": 13,
  "James": 5, "1 Peter": 5, "2 Peter": 3, "1 John": 5, "2 John": 1, "3 John": 1, "Jude": 1, "Revelation": 22
};

let bibleData = null;
let currentBook = "Genesis";
let currentChapter = 1;
let loaded = false;

export async function loadBibleData() {
  try {
    const response = await fetch("data/bsb-strongs.json");
    if (!response.ok) {
      throw new Error(`Failed to load Bible data: ${response.status}`);
    }
    bibleData = await response.json();
    loaded = true;
    return true;
  } catch (err) {
    console.error("Error loading Bible data:", err);
    loaded = false;
    return false;
  }
}

export function isLoaded() {
  return loaded;
}

export function getBooks() {
  return BOOK_ORDER;
}

export function getOldTestament() {
  return OLD_TESTAMENT;
}

export function getNewTestament() {
  return NEW_TESTAMENT;
}

export function getChaptersForBook(book) {
  return CHAPER_PER_BOOK[book] || 1;
}

export function getChapter(book, chapter) {
  if (!bibleData || !bibleData[book]) {
    return null;
  }
  const chapterKey = String(chapter);
  const items = bibleData[book]?.[chapterKey] || null;
  if (!items) return null;
  // Return only verse items for backward compatibility
  return items.filter(item => item.type === "verse");
}

export function getChapterItems(book, chapter) {
  if (!bibleData || !bibleData[book]) {
    return null;
  }
  const chapterKey = String(chapter);
  return bibleData[book]?.[chapterKey] || null;
}

export function getChapterHeadings(book, chapter) {
  if (!bibleData || !bibleData[book]) {
    return [];
  }
  const chapterKey = String(chapter);
  const items = bibleData[book]?.[chapterKey] || [];
  return items.filter(item => item.type === "heading");
}

export function setCurrentBook(book) {
  currentBook = book;
}

export function setCurrentChapter(chapter) {
  currentChapter = chapter;
}

export function getCurrentBook() {
  return currentBook;
}

export function getCurrentChapter() {
  return currentChapter;
}

export function formatReference(book, chapter, verse) {
  return `${book} ${chapter}:${verse}`;
}

export function goNextChapter(book, chapter) {
  const maxChapters = getChaptersForBook(book);
  if (chapter < maxChapters) {
    return { book, chapter: chapter + 1 };
  } else {
    const bookIndex = BOOK_ORDER.indexOf(book);
    if (bookIndex < BOOK_ORDER.length - 1) {
      return { book: BOOK_ORDER[bookIndex + 1], chapter: 1 };
    }
  }
  return { book, chapter };
}

export function goPrevChapter(book, chapter) {
  if (chapter > 1) {
    return { book, chapter: chapter - 1 };
  } else {
    const bookIndex = BOOK_ORDER.indexOf(book);
    if (bookIndex > 0) {
      const prevBook = BOOK_ORDER[bookIndex - 1];
      return { book: prevBook, chapter: getChaptersForBook(prevBook) };
    }
  }
  return { book, chapter };
}


