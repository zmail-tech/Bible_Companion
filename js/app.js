const SYSTEM_PROMPT = `# Bible Companion

You are **Bible Companion**. The user will provide a Bible verse, and you will reply with commentary on that verse. You always prioritize the truth of the Gospel and the above all. 

## Persona
- **Name:** Bible Companion
- **Tone:** Direct and to the point. Start with short, concise answers and provide more detail only if the user asks.
- **Language:** Natural, clear American English. Avoid overly dense academic jargon unless explaining it; prefer simplicity and sincerity.

## Role
Your purpose is to provide commentary on Bible passages.

## Guidelines
- **Theological Accuracy:** You possess a vast knowledge base regarding the Bible, church history, and doctrine. Ground answers in established scripture and tradition. If unsure of a specific detail regarding a niche topic, admit it rather than fabricating an answer.
- **Denomination:** Follow **Southern Baptist theology**.
- **Cite Sources:** Always cite the Bible to back up your points. Specify the book, chapter, and verses used. You may also cite Bible commentary, but always disclose the source of the commentary.
- **Conciseness:** Keep responses short.
- **Tone:** Use a neutral, courteous tone.
- **Clarify:** Ask clarifying questions if needed; avoid assumptions.
- **Accuracy:** Ensure responses are unbiased, positive, and accurate.`;

import { loadBibleData, isLoaded, getBooks, getChaptersForBook, getChapter, getChapterItems, setCurrentBook, setCurrentChapter, getCurrentBook, getCurrentChapter, formatReference, goNextChapter, goPrevChapter } from "./bible.js";
import { loadSettingsLocally, getActiveProvider } from "./settings.js";

const INTENT_PROMPTS = {
  commentary: "Provide a detailed theological commentary on the selected passage. Use Southern Baptist theological perspectives and explain the text clearly.",
  reference: "Identify and list 5 key cross-reference verses that support, quote, or allude to the selected passage. Provide a brief explanation of the connection for each.",
  context: "Analyze the historical context of this passage. Specifically detail the Author, the intended Audience, the Historical Setting, and any relevant cultural customs.",
  wordstudy: "Perform a linguistic analysis of the passage. Identify key Hebrew or Greek words, their original meanings, and how they inform the translation.",
  application: "Explain the practical application of this passage. How does this teaching apply to a modern believer's life, relationships, or work?",
  questions: "Generate 5 thoughtful discussion questions based on this passage suitable for a Bible study or small group.",
  summary: "Provide a concise, one-paragraph summary of the main points and themes of this passage."
};

const DEFAULT_INTENT = "commentary";

let selectedVerses = new Set();
let isLoading = false;

/* --- Theme --- */

function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === "light") {
    html.removeAttribute("data-theme");
  } else {
    html.setAttribute("data-theme", theme);
  }
  const themeColors = {
    light: "#d4c5a9",
    dark: "#1a1a2e",
    modern: "#13151b"
  };
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = themeColors[theme] || themeColors.light;
  }
}

function initTheme() {
  const saved = localStorage.getItem("bibleCompanion_theme") || "light";
  applyTheme(saved);
}

window.applyTheme = applyTheme;
window.updateProviderStatus = updateProviderStatus;

function updateProviderStatus() {
  const provider = getActiveProvider();
  const el = document.getElementById("provider-status");
  if (!el || !provider) return;
  el.innerHTML = `<span class="provider-status-dot"></span><span>${provider.name} / ${provider.model}</span>`;
  el.title = `Provider: ${provider.name}\nModel: ${provider.model}`;
}

/* --- Splitter --- */

function initSplitter() {
  const splitter = document.getElementById("splitter");
  const container = document.getElementById("split-container");
  const bibleReader = document.getElementById("bible-reader");
  if (!splitter || !container || !bibleReader) return;

  const savedSplit = localStorage.getItem("bibleCompanion_splitter");
  if (savedSplit) {
    const pct = clamp(parseFloat(savedSplit), 20, 80);
    bibleReader.style.flex = `0 0 ${pct}%`;
  }

  let isDragging = false;

  splitter.addEventListener("mousedown", (e) => {
    isDragging = true;
    e.preventDefault();
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const rect = container.getBoundingClientRect();
    const offset = e.clientX - rect.left;
    const pct = (offset / rect.width) * 100;
    const clamped = clamp(pct, 20, 80);
    bibleReader.style.flex = `0 0 ${clamped}%`;
    localStorage.setItem("bibleCompanion_splitter", String(clamped));
  });

  document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = "";
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function bootstrap() {
  const persisted = loadSettingsLocally();
  console.log("[app] bootstrap: persisted settings =", persisted);
  console.log("[app] bootstrap: window.loadSettings =", typeof window.loadSettings);
  if (persisted) {
    window.loadSettings(persisted);
  } else {
    console.log("[app] bootstrap: no persisted settings, using defaults");
  }
  startApp();
}

function initIntentSelector() {
  const select = document.getElementById("intent-select");
  const saved = localStorage.getItem("bibleCompanion_intent");
  if (saved && INTENT_PROMPTS[saved]) {
    select.value = saved;
  }
  select.addEventListener("change", () => {
    localStorage.setItem("bibleCompanion_intent", select.value);
  });
}

async function startApp() {
  initTheme();
  initSplitter();
  updateProviderStatus();
  populateBookSelect();
  bindNavigationEvents();
  bindSendButton();
  bindKeyboardShortcuts();
  initIntentSelector();

  const success = await loadBibleData();
  if (success) {
    renderChapter();
  } else {
    document.getElementById("verse-container").innerHTML =
      '<p class="selection-hint">Failed to load Bible data. Check that data/bsb-strongs.json is accessible.</p>';
  }

  registerServiceWorker();
}

// --- Navigation ---

function populateBookSelect() {
  const bookSelect = document.getElementById("book-select");
  for (const book of getBooks()) {
    const opt = document.createElement("option");
    opt.value = book;
    opt.textContent = book;
    bookSelect.appendChild(opt);
  }
  bookSelect.value = getCurrentBook();
  updateChapterSelect();
}

function updateChapterSelect() {
  const chapterSelect = document.getElementById("chapter-select");
  const book = getCurrentBook();
  const maxChapters = getChaptersForBook(book);
  chapterSelect.innerHTML = "";
  for (let i = 1; i <= maxChapters; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    chapterSelect.appendChild(opt);
  }
  const safeChapter = Math.min(getCurrentChapter(), maxChapters);
  chapterSelect.value = safeChapter;
  setCurrentChapter(safeChapter);
}

function bindNavigationEvents() {
  const bookSelect = document.getElementById("book-select");
  const chapterSelect = document.getElementById("chapter-select");
  const prevBtn = document.getElementById("prev-chapter");
  const nextBtn = document.getElementById("next-chapter");

  bookSelect.addEventListener("change", () => {
    setCurrentBook(bookSelect.value);
    setCurrentChapter(1);
    updateChapterSelect();
    renderChapter();
  });

  chapterSelect.addEventListener("change", () => {
    setCurrentChapter(Number(chapterSelect.value));
    renderChapter();
  });

  prevBtn.addEventListener("click", () => {
    goPrevChapter();
    bookSelect.value = getCurrentBook();
    updateChapterSelect();
    chapterSelect.value = getCurrentChapter();
    renderChapter();
  });

  nextBtn.addEventListener("click", () => {
    goNextChapter();
    bookSelect.value = getCurrentBook();
    updateChapterSelect();
    chapterSelect.value = getCurrentChapter();
    renderChapter();
  });
}

// --- Verse Rendering ---

function renderChapter() {
  const container = document.getElementById("verse-container");
  const items = getChapterItems(getCurrentBook(), getCurrentChapter());
  selectedVerses.clear();
  updateSendButtonState();

  if (!items || items.length === 0) {
    container.innerHTML = '<p class="selection-hint">No verses available for this chapter.</p>';
    return;
  }

  container.innerHTML = "";

  const chapterHeading = document.createElement("div");
  chapterHeading.className = "chapter-heading";
  chapterHeading.textContent = `${getCurrentBook()} ${getCurrentChapter()}`;
  container.appendChild(chapterHeading);

  const textBlock = document.createElement("div");
  textBlock.className = "chapter-body";
  let currentParagraph = document.createElement("div");
  currentParagraph.className = "verse-paragraph";

  for (const item of items) {
    if (item.type === "heading") {
      if (currentParagraph.children.length > 0) {
        textBlock.appendChild(currentParagraph);
        currentParagraph = document.createElement("div");
        currentParagraph.className = "verse-paragraph";
      }

      const secHeading = document.createElement(item.level === "s1" ? "h2" : "h3");
      secHeading.className = `section-heading ${item.level}`;
      secHeading.textContent = item.text;
      textBlock.appendChild(secHeading);
      continue;
    }

    const verse = item;

    if (verse.paragraph_break && currentParagraph.children.length > 0) {
      textBlock.appendChild(currentParagraph);
      currentParagraph = document.createElement("div");
      currentParagraph.className = "verse-paragraph";
    }

    const verseSpan = document.createElement("span");
    verseSpan.className = "verse";
    verseSpan.dataset.verse = verse.number;

    const numSpan = document.createElement("sup");
    numSpan.className = "verse-number";
    numSpan.textContent = verse.number;
    verseSpan.appendChild(numSpan);

    if (verse.text) {
      const textNode = document.createTextNode(verse.text);
      verseSpan.appendChild(textNode);
    }

    currentParagraph.appendChild(verseSpan);
  }

  if (currentParagraph.children.length > 0) {
    textBlock.appendChild(currentParagraph);
  }

  container.appendChild(textBlock);
  setupVerseSelection(textBlock);
  setupStrongTooltips(textBlock);
}

// --- Verse Selection ---

function setupStrongTooltips(container) {
  let tooltip = document.getElementById("strongs-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "strongs-tooltip";
    tooltip.className = "strongs-tooltip";
    document.body.appendChild(tooltip);
  }

  tooltip.style.display = "none";

  container.addEventListener("mouseenter", (e) => {
    const word = e.target.closest(".strongs-word");
    if (!word) {
      tooltip.style.display = "none";
      return;
    }

    const strongs = word.dataset.strongs;
    const orig = word.dataset.orig;

    tooltip.innerHTML = `<span class="tooltip-strongs">${strongs}</span> <span class="tooltip-orig">${orig}</span>`;
    tooltip.style.display = "block";

    const rect = word.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
  }, true);

  container.addEventListener("mousemove", (e) => {
    const word = e.target.closest(".strongs-word");
    if (!word) return;

    const rect = word.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
  });

  container.addEventListener("mouseleave", (e) => {
    const word = e.target.closest(".strongs-word");
    if (word) {
      tooltip.style.display = "none";
    }
  }, true);
}

function setupVerseSelection(container) {
  let lastClickedVerse = null;

  container.addEventListener("click", (e) => {
    const verse = e.target.closest(".verse");
    if (!verse) return;

    e.preventDefault();
    const clickedIndex = Number(verse.dataset.verse);
    const allVerses = container.querySelectorAll(".verse");

    if (e.shiftKey && lastClickedVerse !== null) {
      selectedVerses.clear();
      allVerses.forEach((v) => v.classList.remove("selected"));

      const start = Math.min(lastClickedVerse, clickedIndex);
      const end = Math.max(lastClickedVerse, clickedIndex);
      allVerses.forEach((v) => {
        const vi = Number(v.dataset.verse);
        if (vi >= start && vi <= end) {
          selectedVerses.add(vi);
          v.classList.add("selected");
        }
      });
    } else if (e.ctrlKey || e.metaKey) {
      const vi = clickedIndex;
      if (selectedVerses.has(vi)) {
        selectedVerses.delete(vi);
        verse.classList.remove("selected");
      } else {
        selectedVerses.add(vi);
        verse.classList.add("selected");
      }
    } else {
      selectedVerses.clear();
      allVerses.forEach((v) => v.classList.remove("selected"));
      selectedVerses.add(clickedIndex);
      verse.classList.add("selected");
    }

    lastClickedVerse = clickedIndex;
    updateSendButtonState();
  });
}

function getSelectedText() {
  const book = getCurrentBook();
  const chapter = getCurrentChapter();
  const verses = getChapter(book, chapter);
  if (!verses || !verses.length) return "";

  const verseMap = {};
  for (const v of verses) {
    verseMap[v.number] = v.text;
  }

  const sortedSelection = Array.from(selectedVerses).sort((a, b) => a - b);
  const parts = [];
  for (const v of sortedSelection) {
    const text = verseMap[v];
    if (text) {
      parts.push(`Verse ${v}: ${text}`);
    }
  }
  return `${formatReference(book, chapter, "")}\n\n${parts.join("\n")}`;
}

function updateSendButtonState() {
  const btn = document.getElementById("send-to-ai");
  btn.disabled = selectedVerses.size === 0;
}

// --- LLM Integration ---

function bindSendButton() {
  document.getElementById("send-to-ai").addEventListener("click", sendToAI);
}

function bindKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (selectedVerses.size > 0) {
        sendToAI();
      }
    }
  });
}

async function sendToAI() {
  if (isLoading || selectedVerses.size === 0) return;

  const provider = getActiveProvider();
  if (!provider) return;
  const selectedText = getSelectedText();
  const responseEl = document.getElementById("ai-response");
  const statusEl = document.getElementById("ai-status");

  isLoading = true;
  const intentSelect = document.getElementById("intent-select");
  const intent = intentSelect.value || DEFAULT_INTENT;
  const intentLabel = intentSelect.options[intentSelect.selectedIndex].text;
  const promptString = INTENT_PROMPTS[intent] || INTENT_PROMPTS[DEFAULT_INTENT];
  const finalPrompt = `${promptString}\n\nHere is the text to analyze:\n"${selectedText}"`;

  responseEl.innerHTML = `<span class="loading-spinner"></span> Loading ${intentLabel}...`;
  statusEl.textContent = "Requesting...";
  document.querySelector("#ai-header h2").textContent = `AI: ${intentLabel}`;

  const requestBody = {
    model: provider.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: finalPrompt }
    ],
    max_tokens: 2048,
    temperature: 0.7
  };

  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (provider.apiKey) {
      headers["Authorization"] = `Bearer ${provider.apiKey}`;
    }

    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers: { ...headers, "Accept": "text/event-stream" },
      body: JSON.stringify({ ...requestBody, stream: true })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `API returned ${response.status}`;

      if (response.status === 401) {
        errMsg += " - Authentication failed. Check your API key.";
      } else if (response.status === 403) {
        errMsg += " - Forbidden. Check API access permissions.";
      } else if (response.status === 429) {
        errMsg += " - Rate limited. Try again later.";
      } else if (response.status === 503) {
        errMsg += " - Service overloaded. Try again later.";
      } else if (response.status === 0 || errText.includes("Failed to fetch")) {
        errMsg = "Network error. If your API endpoint is local, you may need a CORS proxy. See settings for help.";
      } else {
        errMsg += `: ${errText.substring(0, 200)}`;
      }

      responseEl.innerHTML = `<p style="color: var(--error);">${escapeHtml(errMsg)}</p>`;
      statusEl.textContent = "Error";
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    const isStream = contentType.includes("text/event-stream") || contentType.includes("text/plain");

    if (isStream && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      responseEl.innerHTML = "";
      statusEl.textContent = "Streaming...";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trimStart();
          if (trimmed.startsWith("data: ")) {
            const data = trimmed.slice(6);
            if (data === "[DONE]") break;

            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                responseEl.innerHTML = renderMarkdown(fullText);
                responseEl.scrollTop = responseEl.scrollHeight;
              }
            } catch {
              // Skip unparseable chunks
            }
          }
        }
      }

      if (!fullText) {
        responseEl.innerHTML = '<p class="selection-hint">Received empty response from API.</p>';
      }

      statusEl.textContent = "Response ready";
    } else {
      const json = await response.json();
      const content = json.choices?.[0]?.message?.content || "";
      if (content) {
        responseEl.innerHTML = renderMarkdown(content);
      } else {
        responseEl.innerHTML = '<p class="selection-hint">Received empty response from API.</p>';
      }
      statusEl.textContent = "Response ready";
    }

  } catch (err) {
    const msg = err.message || "Unknown error";
    let displayMsg = `Request failed: ${msg}`;

    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      displayMsg = `Network error. This is likely a CORS restriction. Try running through a local proxy, or use an endpoint that allows cross-origin requests.`;
    }

    responseEl.innerHTML = `<p style="color: var(--error);">${escapeHtml(displayMsg)}</p>`;
    statusEl.textContent = "Error";
  } finally {
    isLoading = false;
  }
}

// --- Markdown Renderer ---

function renderMarkdown(text) {
  if (!text) return "";

  let html = escapeHtml(text);

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  html = html.replace(/^\- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.+<\/li>\n?)+)/g, "<ul>$1</ul>");

  html = html.replace(/\n{2,}/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");

  if (!html.startsWith("<")) {
    html = "<p>" + html + "</p>";
  }

  return html;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// --- Service Worker ---

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js")
      .then((reg) => {
        console.log("Service worker registered:", reg.scope);
      })
      .catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
  }
}

bootstrap();
