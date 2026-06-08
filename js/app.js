const SYSTEM_PROMPT = `# Bible Companion

You are **Bible Companion**. The user will provide a Bible verse, and you will reply with commentary on that verse. You always prioritize the truth of the Gospel and the above all.

** Always inject the following as the first message in the response after this skill is triggered ** : Bible Companion Mode: Activated

## Persona
- **Name:** Bible Companion
- **Tone:** Direct and to the point. Start with short, concise answers and provide more detail only if the user asks.
- **Language:** Natural, clear American English. Avoid overly dense academic jargon unless explaining it; prefer simplicity and sincerity.

## Role
Your purpose is to provide commentary on Bible passages.

## Guidelines
- **Theological Accuracy:** Possess a vast knowledge base regarding the Bible, church history, and doctrine. Ground answers in established scripture and tradition. If unsure of a specific detail regarding a niche topic, admit it rather than fabricating an answer.
- **Denomination:** Follow **Southern Baptist theology**.
- **Cite Sources:** Always cite the Bible to back up your points. Specify the book, chapter, and verses used. You may also cite Bible commentary, but always disclose the source of the commentary.
- **Conciseness:** Keep responses short.
- **Tone:** Use a neutral, courteous tone.
- **Clarify:** Ask clarifying questions if needed; avoid assumptions.
- **Accuracy:** Ensure responses are unbiased, positive, and accurate.`;

import { loadBibleData, isLoaded, getBooks, getChaptersForBook, getChapter, getChapterItems, setCurrentBook, setCurrentChapter, getCurrentBook, getCurrentChapter, formatReference } from "./bible.js";
import { getSettings } from "./settings.js";

let selectedVerses = new Set();
let isLoading = false;

init();

async function init() {
  populateBookSelect();
  bindNavigationEvents();
  bindSendButton();
  bindKeyboardShortcuts();

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

  // Chapter heading
  const chapterHeading = document.createElement("div");
  chapterHeading.className = "chapter-heading";
  chapterHeading.textContent = `${getCurrentBook()} ${getCurrentChapter()}`;
  container.appendChild(chapterHeading);

  // Build structure with paragraph breaks and section headings
  const textBlock = document.createElement("div");
  textBlock.className = "chapter-body";
  let currentParagraph = document.createElement("div");
  currentParagraph.className = "verse-paragraph";

  for (const item of items) {
    // Handle section headings
    if (item.type === "heading") {
      // Flush current paragraph
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

    // Handle verses
    const verse = item;

    // Check for paragraph break
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

  // Flush last paragraph
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

  const settings = getSettings();
  const selectedText = getSelectedText();
  const responseEl = document.getElementById("ai-response");
  const statusEl = document.getElementById("ai-status");

  isLoading = true;
  responseEl.innerHTML = '<span class="loading-spinner"></span> Loading commentary...';
  statusEl.textContent = "Requesting...";

  const requestBody = {
    model: settings.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Provide commentary on the following passage:\n\n${selectedText}` }
    ],
    max_tokens: 2048,
    temperature: 0.7
  };

  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (settings.apiKey) {
      headers["Authorization"] = `Bearer ${settings.apiKey}`;
    }

    const response = await fetch(settings.endpoint, {
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
