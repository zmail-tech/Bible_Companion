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

import { loadBibleData, isLoaded, getBooks, getOldTestament, getNewTestament, getChaptersForBook, getChapter, getChapterItems, setCurrentBook, setCurrentChapter, getCurrentBook, getCurrentChapter, formatReference, goNextChapter, goPrevChapter } from "./bible.js";
import { loadSettingsLocally, getActiveProvider, getCommentaryModel, getPrayerModel, getPrayerSignature, setCommentaryModel, buildAggregatedModelList, getSettings } from "./settings.js";

const INTENT_PROMPTS = {
  commentary: "Provide a detailed theological commentary on the selected passage. Use Southern Baptist theological perspectives and explain the text clearly.",
  reference: "Identify and list 5 key cross-reference verses that support, quote, or allude to the selected passage. Provide a brief explanation of the connection for each.",
  context: "Analyze the historical context of this passage. Specifically detail the Author, the intended Audience, the Historical Setting, and any relevant cultural customs.",
  wordstudy: "Perform a linguistic analysis of the passage. Identify key Hebrew or Greek words, their original meanings, and how they inform the translation.",
  application: "Explain the practical application of this passage. How does this teaching apply to a modern believer's life, relationships, or work?",
  questions: "Generate 5 thoughtful discussion questions based on this passage suitable for a Bible study or small group.",
  summary: "Provide a concise, one-paragraph summary of the main points and themes of this passage.",
  crosscommentary: "Compare how different theologians and scholarly traditions interpret this passage. Include perspectives from John Calvin, Augustine, Martin Luther, and at least one modern evangelical scholar. Highlight where they agree, where they diverge, and why."
};

const DEFAULT_INTENT = "commentary";
const PRAYER_STORAGE_KEY = "bibleCompanion_prayerCompanion";
const PRAYER_SYSTEM_PROMPT = `Format the input as a Markdown prayer-request list. Use ## for people/groups, ### for subgroups, * * * between sections, and bullet points starting with "Pray for...". Preserve facts exactly as given — do not invent anything.`;

let tabs = [];
let activeTabId = null;
let nextTabId = 1;
let isLoading = false;
let isPrayerMode = false;

let prayerTabs = [];
let activePrayerTabId = null;
let nextPrayerTabId = 1;

/* --- Tabs --- */

function createTab(book, chapter) {
  const id = nextTabId++;
  const tab = {
    id,
    book: book || getCurrentBook(),
    chapter: chapter || getCurrentChapter(),
    selectedVerses: new Set(),
    aiResponse: "",
    aiStatus: "",
    aiTitle: "AI Commentary",
    intent: "commentary",
  };
  tabs.push(tab);
  switchToTab(id);
  saveTabsToStorage();
  return tab;
}

function closeTab(tabId) {
  if (tabs.length <= 1) return;
  const idx = tabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;
  tabs.splice(idx, 1);
  if (activeTabId === tabId) {
    const newIdx = Math.min(idx, tabs.length - 1);
    switchToTab(tabs[newIdx].id);
  }
  renderTabBar();
  saveTabsToStorage();
}

function switchToTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  if (isPrayerMode) switchMode("bible");
  activeTabId = tab.id;
  setCurrentBook(tab.book);
  setCurrentChapter(tab.chapter);
  updateBookTrigger();
  updateChapterSelect();
  const chapterSelect = document.getElementById("chapter-select");
  if (chapterSelect) chapterSelect.value = tab.chapter;
  renderChapter();
  restoreAIResponse(tab);
  renderTabBar();
  saveTabsToStorage();
}

function getActiveTab() {
  return tabs.find(t => t.id === activeTabId) || null;
}

function restoreAIResponse(tab) {
  const responseEl = document.getElementById("ai-response");
  const statusEl = document.getElementById("ai-status");
  const titleEl = document.querySelector("#ai-header h2");
  if (tab.aiResponse) {
    responseEl.innerHTML = tab.aiResponse;
  } else {
    responseEl.innerHTML = '<p class="selection-hint">Select verses and send to Bible Companion for commentary.</p>';
  }
  if (statusEl) statusEl.textContent = tab.aiStatus || "";
  if (titleEl) titleEl.textContent = tab.aiTitle || "AI Commentary";
}

function renderTabBar() {
  const tabBar = document.getElementById("tab-bar");
  if (!tabBar) return;
  tabBar.innerHTML = "";

  if (isPrayerMode) {
    for (const tab of prayerTabs) {
      const tabItem = document.createElement("div");
      tabItem.className = `tab-item${tab.id === activePrayerTabId ? " active" : ""}`;
      tabItem.dataset.tabId = tab.id;
      let clickTimer = null;
      tabItem.addEventListener("click", (e) => {
        if (e.target.classList.contains("tab-close")) return;
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
          startInlineTabRename(tabItem, tab.id, tab.name);
        } else {
          clickTimer = setTimeout(() => {
            clickTimer = null;
            switchToPrayerTab(tab.id);
          }, 250);
        }
      });

      const titleSpan = document.createElement("span");
      titleSpan.className = "tab-title";
      titleSpan.textContent = tab.name;
      titleSpan.title = tab.name;
      tabItem.appendChild(titleSpan);

      const closeBtn = document.createElement("button");
      closeBtn.className = "tab-close";
      closeBtn.setAttribute("aria-label", "Close tab");
      closeBtn.textContent = "\u00d7";
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Delete tab "${tab.name}"?`)) {
          closePrayerTab(tab.id);
        }
      });
      tabItem.appendChild(closeBtn);

      tabBar.appendChild(tabItem);
    }

    const addBtn = document.createElement("button");
    addBtn.id = "add-tab-btn";
    addBtn.className = "icon-btn";
    addBtn.setAttribute("aria-label", "New prayer tab");
    addBtn.textContent = "+";
    addBtn.addEventListener("click", () => {
      createPrayerTab("New List");
    });
    tabBar.appendChild(addBtn);
  } else {
    for (const tab of tabs) {
      const tabItem = document.createElement("div");
      tabItem.className = `tab-item${tab.id === activeTabId ? " active" : ""}`;
      tabItem.dataset.tabId = tab.id;
      tabItem.addEventListener("click", (e) => {
        if (e.target.classList.contains("tab-close")) return;
        switchToTab(tab.id);
      });

      const titleSpan = document.createElement("span");
      titleSpan.className = "tab-title";
      titleSpan.textContent = `${tab.book} ${tab.chapter}`;
      tabItem.appendChild(titleSpan);

      const closeBtn = document.createElement("button");
      closeBtn.className = "tab-close";
      closeBtn.setAttribute("aria-label", "Close tab");
      closeBtn.textContent = "\u00d7";
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      });
      tabItem.appendChild(closeBtn);

      tabBar.appendChild(tabItem);
    }

    const addBtn = document.createElement("button");
    addBtn.id = "add-tab-btn";
    addBtn.className = "icon-btn";
    addBtn.setAttribute("aria-label", "New tab");
    addBtn.textContent = "+";
    addBtn.addEventListener("click", () => {
      const active = getActiveTab();
      createTab(active ? active.book : "Genesis", active ? active.chapter : 1);
    });
    tabBar.appendChild(addBtn);
  }
}

function saveTabsToStorage() {
  const data = tabs.map(t => ({
    id: t.id,
    book: t.book,
    chapter: t.chapter,
  }));
  localStorage.setItem("bibleCompanion_tabs", JSON.stringify(data));
  localStorage.setItem("bibleCompanion_activeTabId", String(activeTabId));
  localStorage.setItem("bibleCompanion_nextTabId", String(nextTabId));
}

function loadTabsFromStorage() {
  try {
    const data = JSON.parse(localStorage.getItem("bibleCompanion_tabs"));
    const savedActiveId = Number(localStorage.getItem("bibleCompanion_activeTabId"));
    const savedNextId = Number(localStorage.getItem("bibleCompanion_nextTabId"));
    if (data && Array.isArray(data) && data.length > 0) {
      tabs = data.map(d => ({
        id: d.id,
        book: d.book,
        chapter: d.chapter,
        selectedVerses: new Set(),
        aiResponse: "",
        aiStatus: "",
        aiTitle: "AI Commentary",
        intent: "commentary",
      }));
      nextTabId = savedNextId || (Math.max(...tabs.map(t => t.id)) + 1);
      const restoreId = savedActiveId && tabs.find(t => t.id === savedActiveId) ? savedActiveId : tabs[0].id;
      switchToTab(restoreId);
      return true;
    }
  } catch {
    // Ignore parse errors
  }
  return false;
}

/* --- End Tabs --- */

/* --- Prayer Tabs --- */

function createPrayerTab(name, content) {
  const id = nextPrayerTabId++;
  const tab = {
    id,
    name: name || "New List",
    content: content || "",
  };
  prayerTabs.push(tab);
  switchToPrayerTab(id);
  savePrayerTabsToStorage();
  return tab;
}

function closePrayerTab(tabId) {
  if (prayerTabs.length <= 1) return;
  const idx = prayerTabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;
  prayerTabs.splice(idx, 1);
  if (activePrayerTabId === tabId) {
    const newIdx = Math.min(idx, prayerTabs.length - 1);
    switchToPrayerTab(prayerTabs[newIdx].id);
  }
  renderTabBar();
  savePrayerTabsToStorage();
}

function switchToPrayerTab(tabId) {
  const tab = prayerTabs.find(t => t.id === tabId);
  if (!tab) return;
  activePrayerTabId = tab.id;
  const textarea = document.getElementById("prayer-textarea");
  if (textarea) textarea.value = tab.content;
  updatePrayerPreview();
  renderTabBar();
  savePrayerTabsToStorage();
}

function getActivePrayerTab() {
  return prayerTabs.find(t => t.id === activePrayerTabId) || null;
}

function renamePrayerTab(tabId, newName) {
  const tab = prayerTabs.find(t => t.id === tabId);
  if (tab) {
    tab.name = newName;
    renderTabBar();
    savePrayerTabsToStorage();
  }
}

function startInlineTabRename(tabItem, tabId, currentName) {
  const titleEl = tabItem.querySelector(".tab-title");
  if (!titleEl || tabItem.querySelector(".tab-rename-input")) return;

  const input = document.createElement("input");
  input.className = "tab-rename-input";
  input.type = "text";
  input.value = currentName;
  input.maxLength = 50;

  titleEl.style.display = "none";
  titleEl.parentNode.insertBefore(input, titleEl);
  input.focus();
  input.select();

  const finish = () => {
    const val = input.value.trim();
    if (val && val !== currentName) {
      renamePrayerTab(tabId, val);
    } else {
      renderTabBar();
    }
  };

  input.addEventListener("blur", finish);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    } else if (e.key === "Escape") {
      input.value = currentName;
      input.blur();
    }
    e.stopPropagation();
  });
}

function savePrayerTabsToStorage() {
  localStorage.setItem("bibleCompanion_prayerTabs", JSON.stringify(prayerTabs));
  localStorage.setItem("bibleCompanion_activePrayerTabId", String(activePrayerTabId));
  localStorage.setItem("bibleCompanion_nextPrayerTabId", String(nextPrayerTabId));
}

function loadPrayerTabsFromStorage() {
  try {
    const data = JSON.parse(localStorage.getItem("bibleCompanion_prayerTabs"));
    const savedActiveId = Number(localStorage.getItem("bibleCompanion_activePrayerTabId"));
    const savedNextId = Number(localStorage.getItem("bibleCompanion_nextPrayerTabId"));
    if (data && Array.isArray(data) && data.length > 0) {
      prayerTabs = data;
      nextPrayerTabId = savedNextId || (Math.max(...prayerTabs.map(t => t.id)) + 1);
      const restoreId = savedActiveId && prayerTabs.find(t => t.id === savedActiveId) ? savedActiveId : prayerTabs[0].id;
      activePrayerTabId = restoreId;
      return true;
    }
  } catch {
    // Ignore parse errors
  }

  // Migration: check for old prayer storage key
  const oldData = localStorage.getItem(PRAYER_STORAGE_KEY);
  if (oldData !== null) {
    prayerTabs = [{ id: 1, name: "General", content: oldData }];
    activePrayerTabId = 1;
    nextPrayerTabId = 2;
    localStorage.removeItem(PRAYER_STORAGE_KEY);
    savePrayerTabsToStorage();
    return true;
  }

  // Default empty tab
  prayerTabs = [{ id: 1, name: "General", content: "" }];
  activePrayerTabId = 1;
  nextPrayerTabId = 2;
  savePrayerTabsToStorage();
  return false;
}

/* --- End Prayer Tabs --- */

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
  const commentary = getCommentaryModel();
  const prayer = getPrayerModel();
  const el = document.getElementById("provider-status");
  if (!el) return;

  if (!commentary) {
    el.innerHTML = `<span class="provider-status-dot"></span><span>No model configured</span>`;
    return;
  }

  const commentaryDisplay = commentary.provider.name + " / " + commentary.modelId;
  const prayerDisplay = prayer ? prayer.provider.name + " / " + prayer.modelId : commentaryDisplay;

  if (commentaryDisplay === prayerDisplay) {
    el.innerHTML = `<span class="provider-status-dot"></span><span>${commentaryDisplay}</span>`;
    el.title = `Commentary: ${commentaryDisplay}\nPrayer: ${prayerDisplay} (same)`;
  } else {
    el.innerHTML = `<span class="provider-status-dot"></span><span>${commentaryDisplay} | ${prayerDisplay}</span>`;
    el.title = `Commentary: ${commentaryDisplay}\nPrayer: ${prayerDisplay}`;
  }
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

function initModelSwitcher() {
  const switcher = document.querySelector(".model-switcher");
  const select = document.getElementById("header-model-select");
  if (!switcher || !select) return;

  function populateDropdown() {
    const models = buildAggregatedModelList();
    select.innerHTML = "";
    if (models.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "No models — open Settings to refresh";
      opt.disabled = true;
      select.appendChild(opt);
      return;
    }
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m.providerId + "::" + m.modelId;
      opt.textContent = m.displayName;
      select.appendChild(opt);
    }
    select.value = getSettings().commentaryModel || "";
  }

  populateDropdown();

  switcher.addEventListener("click", (e) => {
    e.stopPropagation();
    switcher.classList.toggle("open");
  });

  select.addEventListener("change", () => {
    const value = select.value;
    if (value) {
      setCommentaryModel(value);
      if (window.updateProviderStatus) window.updateProviderStatus();
    }
    switcher.classList.remove("open");
  });

  select.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", (e) => {
    if (!switcher.contains(e.target)) {
      switcher.classList.remove("open");
    }
  });
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

const IntentIcons = {
  commentary: "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'/><path d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'/></svg>",
  reference: "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M10 12.5 9 15h3l-1-3Z'/><path d='m14 12.5 1 2.5h-3l1-3'/><path d='M9 9h6l-1.5-4H10Z'/><path d='M12 5v14'/></svg>",
  context: "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect width='18' height='18' x='3' y='3' rx='2'/><path d='M7 7h.01'/><path d='M17 7h.01'/><path d='M7 17h.01'/><path d='M17 17h.01'/><path d='M12 8v8'/></svg>",
  wordstudy: "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 7c0-1.2 1-2 2-2h12a2 2 0 0 1 2 2v5c0 1.2-1 2-2 2H6a2 2 0 0 1-2-2Z'/><path d='M12 12v7'/><path d='M8 16h8'/></svg>",
  application: "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 2v4'/><path d='m16.2 7.8 2.9-2.9'/><path d='M18 12h4'/><path d='m16.2 16.2 2.9 2.9'/><path d='M12 18v4'/><path d='m4.9 19.1 2.9-2.9'/><path d='M2 12h4'/><path d='m4.9 4.9 2.9 2.9'/></svg>",
  questions: "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><path d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'/><path d='M12 17h.01'/></svg>",
  summary: "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'/><path d='M8 2h8'/><path d='M8 10h8'/><path d='M8 14h8'/></svg>",
  crosscommentary: "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M23 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/></svg>",
};

const IntentLabels = {
  commentary: "Commentary",
  reference: "Reference Verses",
  context: "Context & Background",
  wordstudy: "Word Study",
  application: "Modern Application",
  questions: "Study Questions",
  summary: "Summary",
  crosscommentary: "Cross-Commentary",
};

const IntentDescriptions = {
  commentary: "Detailed theological commentary with Southern Baptist perspectives",
  reference: "Key cross-reference verses that support or allude to this passage",
  context: "Historical setting, author, audience, and cultural background",
  wordstudy: "Hebrew/Greek word analysis with original meanings",
  application: "Practical takeaways for modern believers",
  questions: "Discussion questions for Bible study or small groups",
  summary: "Concise one-paragraph summary of main themes",
  crosscommentary: "Compare interpretations from Calvin, Augustine, Luther, and modern scholars",
};

function initAiIntentBox() {
  const grid = document.getElementById("ai-intent-grid");
  if (!grid) return;
  grid.innerHTML = "";
  for (const [key, label] of Object.entries(IntentLabels)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ai-intent-btn";
    btn.dataset.intent = key;
    btn.innerHTML = `${IntentIcons[key] || ""}<span>${label}</span>`;
    btn.title = IntentDescriptions[key] || "";
    btn.addEventListener("click", () => {
      sendToAIWithIntent(key);
    });
    grid.appendChild(btn);
  }
}

function setIntentButtonsLoading(loading) {
  const buttons = document.querySelectorAll(".ai-intent-btn");
  buttons.forEach((btn) => {
    btn.disabled = loading;
    if (loading) {
      btn.classList.add("loading");
    } else {
      btn.classList.remove("loading");
    }
  });
}

function setIntentButtonLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.classList.add("loading");
  } else {
    btn.classList.remove("loading");
  }
}

function sendToAIWithIntent(intentKey) {
  const tab = getActiveTab();
  if (!tab) return;
  const btn = document.querySelector(`.ai-intent-btn[data-intent="${intentKey}"]`);
  setIntentButtonLoading(btn, true);
  sendToAI(intentKey).finally(() => {
    setIntentButtonsLoading(false);
  });
}

async function startApp() {
  initTheme();
  initSplitter();
  updateProviderStatus();
  initModelSwitcher();
  populateBookSelect();
  bindNavigationEvents();
  bindKeyboardShortcuts();
  initAiIntentBox();

  const success = await loadBibleData();
  if (success) {
    const restored = loadTabsFromStorage();
    if (!restored) {
      createTab("Genesis", 1);
    }
  } else {
    document.getElementById("verse-container").innerHTML =
      '<p class="selection-hint">Failed to load Bible data. Check that data/bsb-strongs.json is accessible.</p>';
  }

  registerServiceWorker();
  initPrayerMode();
}

// --- Navigation ---

function populateBookSelect() {
  const trigger = document.getElementById("book-select");
  const otColumn = document.getElementById("ot-column");
  const ntColumn = document.getElementById("nt-column");
  const panel = document.querySelector(".book-dropdown-panel");

  otColumn.innerHTML = '<div class="book-testament-title">Old Testament</div>';
  ntColumn.innerHTML = '<div class="book-testament-title">New Testament</div>';

  for (const book of getOldTestament()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "book-item";
    btn.textContent = book;
    btn.dataset.book = book;
    btn.addEventListener("click", () => selectBook(book));
    otColumn.appendChild(btn);
  }

  for (const book of getNewTestament()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "book-item";
    btn.textContent = book;
    btn.dataset.book = book;
    btn.addEventListener("click", () => selectBook(book));
    ntColumn.appendChild(btn);
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isExpanded = trigger.getAttribute("aria-expanded") === "true";
    trigger.setAttribute("aria-expanded", String(!isExpanded));
    panel.classList.toggle("open", !isExpanded);
  });

  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      trigger.click();
    }
  });

  document.addEventListener("click", (e) => {
    if (!document.getElementById("book-dropdown").contains(e.target)) {
      trigger.setAttribute("aria-expanded", "false");
      panel.classList.remove("open");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      trigger.setAttribute("aria-expanded", "false");
      panel.classList.remove("open");
    }
  });

  updateBookTrigger();
  updateChapterSelect();
}

function updateBookTrigger() {
  const trigger = document.getElementById("book-select");
  if (trigger) trigger.textContent = getCurrentBook();
}

function selectBook(book) {
  setCurrentBook(book);
  setCurrentChapter(1);
  const tab = getActiveTab();
  if (tab) {
    tab.book = book;
    tab.chapter = 1;
  }
  updateBookTrigger();
  updateChapterSelect();
  const chapterSelect = document.getElementById("chapter-select");
  if (chapterSelect) chapterSelect.value = 1;
  renderChapter();
  if (tab) {
    saveTabsToStorage();
    renderTabBar();
  }

  const trigger = document.getElementById("book-select");
  const panel = document.querySelector(".book-dropdown-panel");
  trigger.setAttribute("aria-expanded", "false");
  panel.classList.remove("open");
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
  const chapterSelect = document.getElementById("chapter-select");
  const prevBtn = document.getElementById("prev-chapter");
  const nextBtn = document.getElementById("next-chapter");

  chapterSelect.addEventListener("change", () => {
    const tab = getActiveTab();
    if (!tab) return;
    tab.chapter = Number(chapterSelect.value);
    setCurrentChapter(tab.chapter);
    renderChapter();
    saveTabsToStorage();
    renderTabBar();
  });

  prevBtn.addEventListener("click", () => {
    const tab = getActiveTab();
    if (!tab) return;
    const result = goPrevChapter(tab.book, tab.chapter);
    tab.book = result.book;
    tab.chapter = result.chapter;
    setCurrentBook(tab.book);
    setCurrentChapter(tab.chapter);
    updateBookTrigger();
    updateChapterSelect();
    chapterSelect.value = tab.chapter;
    renderChapter();
    saveTabsToStorage();
    renderTabBar();
  });

  nextBtn.addEventListener("click", () => {
    const tab = getActiveTab();
    if (!tab) return;
    const result = goNextChapter(tab.book, tab.chapter);
    tab.book = result.book;
    tab.chapter = result.chapter;
    setCurrentBook(tab.book);
    setCurrentChapter(tab.chapter);
    updateBookTrigger();
    updateChapterSelect();
    chapterSelect.value = tab.chapter;
    renderChapter();
    saveTabsToStorage();
    renderTabBar();
  });
}

// --- Verse Rendering ---

function renderChapter() {
  const container = document.getElementById("verse-container");
  const tab = getActiveTab();
  if (!tab) return;
  const items = getChapterItems(tab.book, tab.chapter);
  tab.selectedVerses.clear();
  updateSendButtonState();

  if (!items || items.length === 0) {
    container.innerHTML = '<p class="selection-hint">No verses available for this chapter.</p>';
    return;
  }

  container.innerHTML = "";

  const chapterHeading = document.createElement("div");
  chapterHeading.className = "chapter-heading";
  chapterHeading.textContent = `${tab.book} ${tab.chapter}`;
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

  const bsbNote = document.createElement("div");
  bsbNote.className = "bible-source-note";
  bsbNote.textContent = "Scripture text from the Berean Standard Bible (BSB), CC0 Public Domain.";
  container.appendChild(bsbNote);

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
    const tab = getActiveTab();
    if (!tab) return;

    if (e.shiftKey && lastClickedVerse !== null) {
      tab.selectedVerses.clear();
      allVerses.forEach((v) => v.classList.remove("selected"));

      const start = Math.min(lastClickedVerse, clickedIndex);
      const end = Math.max(lastClickedVerse, clickedIndex);
      allVerses.forEach((v) => {
        const vi = Number(v.dataset.verse);
        if (vi >= start && vi <= end) {
          tab.selectedVerses.add(vi);
          v.classList.add("selected");
        }
      });
    } else if (e.ctrlKey || e.metaKey) {
      const vi = clickedIndex;
      if (tab.selectedVerses.has(vi)) {
        tab.selectedVerses.delete(vi);
        verse.classList.remove("selected");
      } else {
        tab.selectedVerses.add(vi);
        verse.classList.add("selected");
      }
    } else {
      tab.selectedVerses.clear();
      allVerses.forEach((v) => v.classList.remove("selected"));
      tab.selectedVerses.add(clickedIndex);
      verse.classList.add("selected");
    }

    lastClickedVerse = clickedIndex;
    updateSendButtonState();
  });
}

function getSelectedText() {
  const tab = getActiveTab();
  if (!tab) return "";
  const verses = getChapter(tab.book, tab.chapter);
  if (!verses || !verses.length) return "";

  const verseMap = {};
  for (const v of verses) {
    verseMap[v.number] = v.text;
  }

  const sortedSelection = Array.from(tab.selectedVerses).sort((a, b) => a - b);
  const parts = [];
  for (const v of sortedSelection) {
    const text = verseMap[v];
    if (text) {
      parts.push(`Verse ${v}: ${text}`);
    }
  }
  return `${formatReference(tab.book, tab.chapter, "")}\n\n${parts.join("\n")}`;
}

function getChapterText() {
  const tab = getActiveTab();
  if (!tab) return "";
  const verses = getChapter(tab.book, tab.chapter);
  if (!verses || !verses.length) return "";

  const parts = [];
  for (const v of verses) {
    if (v.text) {
      parts.push(`Verse ${v.number}: ${v.text}`);
    }
  }
  return `${formatReference(tab.book, tab.chapter, "")}\n\n${parts.join("\n")}`;
}

function updateSendButtonState() {
  // No-op: send-to-ai button removed, replaced with intent grid
}

// --- LLM Integration ---

function bindKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      const tab = getActiveTab();
      if (tab) {
        sendToAIWithIntent(DEFAULT_INTENT);
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "t") {
      e.preventDefault();
      if (isPrayerMode) {
        createPrayerTab("New List");
      } else {
        const active = getActiveTab();
        createTab(active ? active.book : "Genesis", active ? active.chapter : 1);
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "w") {
      e.preventDefault();
      if (isPrayerMode) {
        if (activePrayerTabId) closePrayerTab(activePrayerTabId);
      } else {
        if (activeTabId) closeTab(activeTabId);
      }
    }
    if ((e.altKey) && e.key >= "1" && e.key <= "9") {
      e.preventDefault();
      const idx = Number(e.key) - 1;
      if (isPrayerMode) {
        if (idx < prayerTabs.length) {
          switchToPrayerTab(prayerTabs[idx].id);
        }
      } else {
        if (idx < tabs.length) {
          switchToTab(tabs[idx].id);
        }
      }
    }
  });
}

async function sendToAI(intentKey) {
  const tab = getActiveTab();
  if (isLoading || !tab) return;

  const commentaryConfig = getCommentaryModel();
  if (!commentaryConfig) {
    const responseEl = document.getElementById("ai-response");
    responseEl.innerHTML = '<p style="color: var(--error);">No commentary model configured. Please select a model in Settings > Models.</p>';
    return;
  }
  const provider = commentaryConfig.provider;
  const selectedText = tab.selectedVerses.size > 0 ? getSelectedText() : getChapterText();
  const responseEl = document.getElementById("ai-response");
  const statusEl = document.getElementById("ai-status");

  isLoading = true;
  const intent = intentKey || DEFAULT_INTENT;
  const intentLabel = IntentLabels[intent] || IntentLabels[DEFAULT_INTENT];
  const promptString = INTENT_PROMPTS[intent] || INTENT_PROMPTS[DEFAULT_INTENT];
  const finalPrompt = `${promptString}\n\nHere is the text to analyze:\n"${selectedText}"`;

  tab.intent = intent;

  responseEl.innerHTML = `<span class="loading-spinner"></span> Loading ${intentLabel}...`;
  statusEl.textContent = "Requesting...";
  document.querySelector("#ai-header h2").textContent = `AI: ${intentLabel}`;
  tab.aiTitle = `AI: ${intentLabel}`;

  const requestBody = {
    model: commentaryConfig.modelId,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: finalPrompt }
    ],
    max_tokens: 2048,
    temperature: 0.7
  };

  console.log("[ai] AI request body", {
    provider: provider.name,
    model: commentaryConfig.modelId,
    messageCount: requestBody.messages.length,
    systemPromptLength: requestBody.messages[0].content.length,
    userPromptLength: requestBody.messages[1].content.length,
    max_tokens: requestBody.max_tokens,
    stream: requestBody.stream
  });

  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (provider.apiKey) {
      headers["Authorization"] = `Bearer ${provider.apiKey}`;
    }

    const REQUEST_TIMEOUT = 120000; // 120 seconds
    const STREAM_IDLE_TIMEOUT = 30000; // 30 seconds with no stream data
    const abortController = new AbortController();
    let activeAbortReason = "";
    const timeoutId = setTimeout(() => {
      activeAbortReason = "Request timed out after 120s";
      abortController.abort();
    }, REQUEST_TIMEOUT);

    headers["Cache-Control"] = "no-cache";
    console.log("[ai] request started", { model: commentaryConfig.modelId, promptLength: finalPrompt.length });

    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers: { ...headers, "Accept": "text/event-stream" },
      body: JSON.stringify({ ...requestBody, stream: true }),
      signal: abortController.signal
    }).finally(() => clearTimeout(timeoutId));

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
      tab.aiResponse = responseEl.innerHTML;
      tab.aiStatus = "Error";
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    // llama.cpp uses application/x-ndjson; OpenAI/SSE uses text/event-stream; some servers use text/plain
    // Since we always request stream:true, treat successful responses with body as streamable
    const isStreamContentType = contentType.includes("text/event-stream")
      || contentType.includes("text/plain")
      || contentType.includes("application/x-ndjson");
    const isSSE = contentType.includes("text/event-stream");
    const isNDJSON = contentType.includes("application/x-ndjson");
    console.log("[ai] response content-type:", contentType, { isSSE, isNDJSON });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    responseEl.innerHTML = "";
    statusEl.textContent = "Streaming...";
    tab.aiStatus = "Streaming...";
    console.log("[ai] stream started", { contentType });

    let streamIdleTimer = null;
    let streamedChunks = 0;
    const resetStreamIdleTimer = () => {
      if (streamIdleTimer) clearTimeout(streamIdleTimer);
      streamIdleTimer = setTimeout(() => {
        activeAbortReason = "Stream stalled for 30s";
        abortController.abort();
      }, STREAM_IDLE_TIMEOUT);
    };

    resetStreamIdleTimer();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        clearTimeout(streamIdleTimer);
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let dataStr = trimmed;
          // SSE format: "data: {json}" — strip the "data: " prefix
          if (trimmed.startsWith("data: ")) {
            dataStr = trimmed.slice(6);
          }
          // SSE completion signal
          if (dataStr === "[DONE]") break;

          try {
            const json = JSON.parse(dataStr);
            // Handle delta-based streaming (OpenAI/standard) and full-content (llama.cpp/stream)
            const delta =
              json.choices?.[0]?.delta?.content ||
              json.choices?.[0]?.delta?.text ||
              json.choices?.[0]?.text ||
              json.content ||
              json.response ||
              json.message?.content ||
              "";
            if (delta) {
              streamedChunks += 1;
              fullText += delta;
              if (streamedChunks % 50 === 0) {
                responseEl.innerHTML = renderMarkdown(fullText);
                responseEl.scrollTop = responseEl.scrollHeight;
              }
              if (streamedChunks % 100 === 0) console.log("[ai] streamed", streamedChunks, "chunks");
            }
            // Skip reasoning_content to avoid leaking thinking data
            // (it would appear as noise in the visible response)
          } catch {
            // Skip unparseable chunks
          }
        }

        resetStreamIdleTimer();
      }

      if (fullText) {
        const cleanText = stripThinkingTags(fullText);
        responseEl.innerHTML = renderMarkdown(cleanText);
        responseEl.scrollTop = responseEl.scrollHeight;
      }

      clearTimeout(streamIdleTimer);
    } catch (streamErr) {
      if (streamIdleTimer) clearTimeout(streamIdleTimer);

      if (streamErr.name === "AbortError") {
        if (fullText) {
          const cleanText = stripThinkingTags(fullText);
          responseEl.innerHTML = renderMarkdown(cleanText);
          tab.aiResponse = responseEl.innerHTML;
          tab.aiStatus = activeAbortReason === "Stream stalled for 30s"
            ? "Streaming interrupted: no stream data for 30s. Partial result shown."
            : "Streaming interrupted: request timed out after 120s. Partial result shown.";
          statusEl.textContent = tab.aiStatus;
        } else {
          responseEl.innerHTML = '<p style="color: var(--error);">' + escapeHtml(activeAbortReason === "Stream stalled for 30s"
            ? "No response data for 30s. Try again."
            : "Request timed out after 120s. Try again.") + '</p>';
          tab.aiResponse = responseEl.innerHTML;
          tab.aiStatus = "Error";
          statusEl.textContent = "Error";
        }
      } else {
        throw streamErr;
      }
      }

      if (abortController.signal.aborted) {
        return;
      }

      if (!fullText) {
        console.warn("[ai] empty response after streaming", {
          streamedChunks,
          model: commentaryConfig.modelId,
          endpoint: provider.endpoint,
          contentType
        });
        responseEl.innerHTML = '<p class="selection-hint">Received empty response from API.</p>';
      }

      if (fullText) {
        tab.aiResponse = responseEl.innerHTML;
        tab.aiStatus = "Response ready";
        statusEl.textContent = "Response ready";
      }

  } catch (err) {
    const msg = err.message || "Unknown error";
    let displayMsg = `Request failed: ${msg}`;

    if (err.name === "AbortError") {
      if (activeAbortReason === "Stream stalled for 30s") {
        displayMsg = "Stream stalled for 30s. Try again.";
      } else {
        displayMsg = "Request timed out after 120s. Try again.";
      }
    } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      displayMsg = `Network error. This is likely a CORS restriction. Try running through a local proxy, or use an endpoint that allows cross-origin requests.`;
    }

    responseEl.innerHTML = `<p style="color: var(--error);">${escapeHtml(displayMsg)}</p>`;
    statusEl.textContent = "Error";
    tab.aiResponse = responseEl.innerHTML;
    tab.aiStatus = "Error";
  } finally {
    isLoading = false;
  }
}

// --- Thinking/Reasoning Tag Stripper ---

function stripThinkingTags(text) {
  if (!text) return text;
  let result = text;
  // DeepSeek R1 / OpenAI reasoning / various models use these tags
  result = result
    .replace(/<think[\s>][\s\S]*?<\/think>/gi, "")
    .replace(/<thinking[\s>][\s\S]*?<\/thinking>/gi, "")
    .replace(/<reasoning[\s>][\s\S]*?<\/reasoning>/gi, "")
    .replace(/<thought[\s>][\s\S]*?<\/thought>/gi, "")
    .replace(/<antThinking[\s>][\s\S]*?<\/antThinking>/gi, "")
    .replace(/<thinking_process[\s>][\s\S]*?<\/thinking_process>/gi, "")
    // Gemma reasoning models wrap thinking in explicit markers
    .replace(/%%THINKING%%[\s\S]*?%%THINKING%%/gi, "")
    .replace(/%%THOUGHT%%[\s\S]*?%%THOUGHT%%/gi, "")
  // Catch any <think...> or <reason...> or <thought...> variant
    .replace(/<think[-_\w]*[\s>][\s\S]*?<\/think[-_\w]*>/gi, "")
    .replace(/<reason[-_\w]*[\s>][\s\S]*?<\/reason[-_\w]*>/gi, "")
    .replace(/<thought[-_\w]*[\s>][\s\S]*?<\/thought[-_\w]*>/gi, "")
    .trim();
  return result;
}

// --- Markdown Renderer ---

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderInlineMarkdown(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return out;
}

function isHorizontalRule(line) {
  const trimmed = line.trim();
  const collapsed = trimmed.replace(/\s+/g, "");
  if (collapsed.length < 3) return false;
  const ch = collapsed[0];
  if (ch === "-" || ch === "*" || ch === "_") {
    return [...collapsed].every(c => c === ch);
  }
  return false;
}

function renderMarkdown(text) {
  if (!text) return "";

  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let html = "";
  let i = 0;
  let inFencedCode = false;
  let codeLang = "";
  let codeLines = [];
  let inUl = false;
  let inOl = false;

  function closeList() {
    if (inUl) { html += "</ul>"; inUl = false; }
    if (inOl) { html += "</ol>"; inOl = false; }
  }

  function closePara() {
    if (paraBuf) { html += "<p>" + paraBuf + "</p>"; paraBuf = ""; }
  }

  let paraBuf = "";

  function emitPara() { closePara(); }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inFencedCode) {
      if (trimmed.startsWith("```")) {
        codeLines.push("</code></pre>");
        const all = codeLines.join("");
        html += all;
        inFencedCode = false;
        codeLang = "";
        codeLines = [];
        closePara();
        i++;
        continue;
      }
      codeLines.push(escapeHtml(line) + "\n");
      i++;
      continue;
    }

    if (trimmed.startsWith("```")) {
      closePara();
      closeList();
      inFencedCode = true;
      codeLang = trimmed.slice(3).trim() || "";
      codeLines = [`<pre><code class="language-${escapeHtml(codeLang)}">`];
      i++;
      continue;
    }

    if (trimmed === "") {
      emitPara();
      closeList();
      i++;
      continue;
    }

    if (isHorizontalRule(line)) {
      emitPara();
      closeList();
      html += "<hr class=\"markdown-hr\">";
      i++;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      emitPara();
      closeList();
      const level = headingMatch[1].length;
      html += `<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`;
      i++;
      continue;
    }

    const ulMatch = trimmed.match(/^[\-\*\+]\s+(.+)$/);
    if (ulMatch) {
      emitPara();
      if (inOl) { html += "</ol>"; inOl = false; }
      if (!inUl) { html += "<ul>"; inUl = true; }
      html += `<li>${renderInlineMarkdown(ulMatch[1])}</li>`;
      i++;
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      emitPara();
      if (inUl) { html += "</ul>"; inUl = false; }
      if (!inOl) { html += "<ol>"; inOl = true; }
      html += `<li>${renderInlineMarkdown(olMatch[1])}</li>`;
      i++;
      continue;
    }

    closeList();
    if (paraBuf) paraBuf += "<br>";
    paraBuf += renderInlineMarkdown(trimmed);
    i++;
  }

  if (inFencedCode) {
    codeLines.push("</code></pre>");
    html += codeLines.join("");
  }

  emitPara();
  closeList();

  return sanitizeHtml(html);
}

function sanitizeHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html;

  const scripts = div.querySelectorAll("script");
  for (const script of scripts) {
    script.remove();
  }

  const allElements = div.querySelectorAll("*");
  for (const el of allElements) {
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      if (attr.name.startsWith("on")) {
        el.removeAttribute(attr.name);
      } else if (attr.name === "href" || attr.name === "src") {
        const val = attr.value;
        if (val && val.toLowerCase().startsWith("javascript:")) {
          el.removeAttribute(attr.name);
        }
      }
    }
  }

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

// --- Prayer Companion Mode ---

function switchMode(mode) {
  const wasPrayerMode = isPrayerMode;
  isPrayerMode = mode === "prayer";
  const bibleReader = document.getElementById("bible-reader");
  const splitter = document.getElementById("splitter");
  const navigationBar = document.getElementById("navigation-bar");
  const aiPanel = document.getElementById("ai-panel");
  const aiIntentBox = document.getElementById("ai-intent-box");
  const prayerEditor = document.getElementById("prayer-editor");
  const bibleTab = document.getElementById("mode-bible-tab");
  const prayerTab = document.getElementById("mode-prayer-tab");

  bibleTab.classList.toggle("active", mode === "bible");
  prayerTab.classList.toggle("active", mode === "prayer");

  const tabBar = document.getElementById("tab-bar");

  if (isPrayerMode) {
    bibleReader.classList.add("hidden");
    splitter.classList.add("hidden");
    navigationBar.classList.add("hidden");
    aiPanel.classList.add("hidden");
    if (aiIntentBox) aiIntentBox.classList.add("hidden");
    prayerEditor.classList.remove("hidden");
    tabBar.classList.remove("hidden");
    renderTabBar();
    restorePrayerText();
  } else {
    bibleReader.classList.remove("hidden");
    splitter.classList.remove("hidden");
    navigationBar.classList.remove("hidden");
    aiPanel.classList.remove("hidden");
    if (aiIntentBox) aiIntentBox.classList.remove("hidden");
    prayerEditor.classList.add("hidden");
    tabBar.classList.remove("hidden");
    renderTabBar();
  }
}

function savePrayerText() {
  const textarea = document.getElementById("prayer-textarea");
  const tab = getActivePrayerTab();
  if (tab) {
    tab.content = textarea.value;
    savePrayerTabsToStorage();
  }
  showPrayerStatus("Saved");
}

function restorePrayerText() {
  const tab = getActivePrayerTab();
  const textarea = document.getElementById("prayer-textarea");
  if (tab && textarea) {
    textarea.value = tab.content;
  }
  updatePrayerPreview();
}

function updatePrayerPreview() {
  const textarea = document.getElementById("prayer-textarea");
  const preview = document.getElementById("prayer-preview");
  const text = textarea.value;
  preview.innerHTML = text ? renderMarkdown(text) : '<p class="selection-hint">Nothing to preview yet.</p>';
}

function showPrayerStatus(msg) {
  let status = document.getElementById("prayer-status");
  if (!status) {
    status = document.createElement("span");
    status.id = "prayer-status";
    status.className = "prayer-status";
    status.textContent = msg;
    const toolbar = document.getElementById("prayer-toolbar");
    if (toolbar) {
      toolbar.parentElement.insertBefore(status, toolbar.nextSibling);
    }
  }
  status.textContent = msg;
  status.style.opacity = "1";
  clearTimeout(status._hideTimeout);
  status._hideTimeout = setTimeout(() => {
    status.style.opacity = "0";
  }, 1500);
}

async function copyPrayerToClipboard() {
  const textarea = document.getElementById("prayer-textarea");
  const preview = document.getElementById("prayer-preview");
  const text = textarea.value.trim();
  if (!text) {
    showPrayerStatus("Nothing to copy");
    return;
  }
  const signature = getPrayerSignature();

  // Build formatted HTML from the preview + signature
  const htmlContent = preview.innerHTML + "<p>" + escapeHtml(signature) + "</p>";
  // Build plain-text fallback: raw markdown + signature
  const plainText = text + "\n\n" + signature;

  try {
    if (navigator.clipboard && navigator.clipboard.write) {
      // Try writing both HTML and plain text for rich paste support
      const htmlBlob = new Blob([htmlContent], { type: "text/html" });
      const textBlob = new Blob([plainText], { type: "text/plain" });
      const item = new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob,
      });
      await navigator.clipboard.write([item]);
      showPrayerStatus("Copied");
      return;
    }
    throw new Error("No clipboard API");
  } catch {
    // Fallback: plain text only via hidden textarea
    const ta = document.createElement("textarea");
    ta.value = plainText;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showPrayerStatus("Copied");
    } catch (e) {
      showPrayerStatus("Copy failed");
    } finally {
      document.body.removeChild(ta);
    }
  }
}

let isEnhancingPrayer = false;

async function enhancePrayerWithAI() {
  if (isEnhancingPrayer) return;
  const textarea = document.getElementById("prayer-textarea");
  const text = textarea.value.trim();
  if (!text) {
    showPrayerStatus("Nothing to enhance");
    return;
  }
  const prayerConfig = getPrayerModel();
  if (!prayerConfig) {
    showPrayerStatus("No model configured");
    return;
  }
  const provider = prayerConfig.provider;

  const userPrompt = `PRAYER INPUT:\n\n${text}\n\nPRAY LIST:`;

  textarea.dataset.originalText = textarea.value;
  isEnhancingPrayer = true;
  showPrayerStatus("Enhancing with AI...");

  const requestBody = {
    model: prayerConfig.modelId,
    messages: [
      { role: "system", content: PRAYER_SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    max_tokens: 12000,
    temperature: 0.3
  };

  console.log("[prayer] AI request body", {
    provider: provider.name,
    model: prayerConfig.modelId,
    messageCount: requestBody.messages.length,
    systemPromptLength: requestBody.messages[0].content.length,
    userPromptLength: requestBody.messages[1].content.length,
    max_tokens: requestBody.max_tokens,
    stream: requestBody.stream
  });

  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (provider.apiKey) {
      headers["Authorization"] = `Bearer ${provider.apiKey}`;
    }

    const REQUEST_TIMEOUT = 120000; // 120 seconds
    const STREAM_IDLE_TIMEOUT = 30000; // 30 seconds with no stream data
    const abortController = new AbortController();
    let activeAbortReason = "";
    const timeoutId = setTimeout(() => {
      activeAbortReason = "Request timed out after 120s";
      abortController.abort();
    }, REQUEST_TIMEOUT);

    headers["Cache-Control"] = "no-cache";
    console.log("[prayer] AI request started", { model: prayerConfig.modelId, textLength: text.length });

    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers: { ...headers, "Accept": "text/event-stream" },
      body: JSON.stringify({ ...requestBody, stream: true }),
      signal: abortController.signal
    }).finally(() => clearTimeout(timeoutId));

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
        errMsg = "Network error. If your API endpoint is local, you may need a CORS proxy.";
      } else {
        errMsg += `: ${errText.substring(0, 200)}`;
      }

      showPrayerStatus(errMsg);
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    const isStreamContentType = contentType.includes("text/event-stream")
      || contentType.includes("text/plain")
      || contentType.includes("application/x-ndjson");
    const isSSE = contentType.includes("text/event-stream");
    const isNDJSON = contentType.includes("application/x-ndjson");
    console.log("[prayer] response content-type:", contentType, { isSSE, isNDJSON });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    showPrayerStatus("Streaming...");
    console.log("[prayer] stream started", { contentType });

    let streamIdleTimer = null;
    let streamedChunks = 0;
    const resetStreamIdleTimer = () => {
      if (streamIdleTimer) clearTimeout(streamIdleTimer);
      streamIdleTimer = setTimeout(() => {
        activeAbortReason = "Stream stalled for 30s";
        abortController.abort();
      }, STREAM_IDLE_TIMEOUT);
    };

    resetStreamIdleTimer();

    let reasoningBuffer = ""; // fallback: accumulate reasoning content if regular content is empty
    let finalText = ""; // used both inside stream loop and post-stream check

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        clearTimeout(streamIdleTimer);
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let dataStr = trimmed;
          if (trimmed.startsWith("data: ")) {
            dataStr = trimmed.slice(6);
          }
          if (dataStr === "[DONE]") break;

          try {
            const json = JSON.parse(dataStr);

            // Collect reasoning_content separately if model uses a reasoning model
            const reasoningContent =
              json.choices?.[0]?.delta?.reasoning_content ||
              json.choices?.[0]?.delta?.reasoning ||
              json.choices?.[0]?.delta?.reason ||
              "";
            if (reasoningContent) {
              reasoningBuffer += reasoningContent;
            }

            const delta =
              json.choices?.[0]?.delta?.content ||
              json.choices?.[0]?.delta?.text ||
              json.choices?.[0]?.text ||
              json.content ||
              json.response ||
              json.message?.content ||
              "";
            if (delta) {
              streamedChunks += 1;
              fullText += delta;
              if (streamedChunks % 50 === 0) {
                textarea.value = fullText;
                updatePrayerPreview();
              }
              if (streamedChunks % 100 === 0) console.log("[prayer] AI streamed", streamedChunks, "chunks");
            }
          } catch {
            // Skip unparseable chunks
          }
        }

        resetStreamIdleTimer();
      }

      // Strip thinking tags, use reasoning buffer as fallback if content is empty
      if (fullText) {
        finalText = stripThinkingTags(fullText);
      }

      // If regular content is empty but model produced reasoning, try extracting from reasoning
      if (!finalText && reasoningBuffer) {
        finalText = stripThinkingTags(reasoningBuffer);
      }

      if (finalText) {
        textarea.value = finalText;
        updatePrayerPreview();
      } else {
        console.warn("[prayer] fullText is empty after streaming — model may have output only thinking tokens");
      }

      clearTimeout(streamIdleTimer);
    } catch (streamErr) {
      if (streamIdleTimer) clearTimeout(streamIdleTimer);

      if (streamErr.name === "AbortError") {
        let abortFinalText = "";
        if (fullText) {
          abortFinalText = stripThinkingTags(fullText);
        }
        // Fallback to reasoning content if regular content is empty
        if (!abortFinalText && reasoningBuffer) {
          abortFinalText = stripThinkingTags(reasoningBuffer);
        }
        if (abortFinalText) {
          textarea.value = abortFinalText;
          updatePrayerPreview();
          updateUndoButton();
          if (activeAbortReason === "Stream stalled for 30s") {
            showPrayerStatus("Streaming interrupted: no stream data for 30s. Partial result shown.");
          } else {
            showPrayerStatus("Streaming interrupted: request timed out after 120s. Partial result shown.");
          }
        } else {
          if (activeAbortReason === "Stream stalled for 30s") {
            showPrayerStatus("No response data for 30s. Try again with a shorter input.");
          } else {
            showPrayerStatus("Request timed out after 120s. Try again with a shorter input.");
          }
        }
      } else {
        throw streamErr;
      }
    }

    if (abortController.signal.aborted) {
      return;
    }

    if (!finalText) {
      console.warn("[prayer] empty response after streaming", {
        streamedChunks,
        fullTextLength: fullText.length,
        reasoningBufferLength: reasoningBuffer.length,
        model: prayerConfig.modelId,
        endpoint: provider.endpoint,
        contentType
      });
      if (sawReasoningContent) {
        showPrayerStatus("Model output only reasoning/thinking content. Check console for details.");
      } else {
        showPrayerStatus("Received empty response from API.");
      }
    } else {
      updateUndoButton();
      showPrayerStatus("Enhanced");
    }

  } catch (err) {
    const msg = err.message || "Unknown error";
    let displayMsg = `Enhancement failed: ${msg}`;

    if (err.name === "AbortError") {
      if (activeAbortReason === "Stream stalled for 30s") {
        displayMsg = "Stream stalled for 30s. Try again with a shorter input.";
      } else {
        displayMsg = "Request timed out after 120s. Try again with a shorter input.";
      }
    } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      displayMsg = "Network error. This is likely a CORS restriction. Try running through a local proxy.";
    }

    showPrayerStatus(displayMsg);
  } finally {
    isEnhancingPrayer = false;
  }
}




function undoPrayerEnhancement() {
  const textarea = document.getElementById("prayer-textarea");
  const original = textarea.dataset.originalText;
  if (original === undefined) {
    showPrayerStatus("Nothing to undo");
    return;
  }
  textarea.value = original;
  delete textarea.dataset.originalText;
  updatePrayerPreview();
  updateUndoButton();
  showPrayerStatus("Reverted to original");
}

function updateUndoButton() {
  const textarea = document.getElementById("prayer-textarea");
  const undoBtn = document.getElementById("undo-prayer-btn");
  if (!undoBtn) return;
  undoBtn.disabled = textarea.dataset.originalText === undefined;
}

function initPrayerMode() {
  const bibleTab = document.getElementById("mode-bible-tab");
  const prayerTab = document.getElementById("mode-prayer-tab");
  const prayerTextarea = document.getElementById("prayer-textarea");
  const prayerCopyBtn = document.getElementById("prayer-copy-btn");
  const prayerSaveBtn = document.getElementById("prayer-save-btn");
  const enhanceBtn = document.getElementById("enhance-prayer-btn");
  const undoBtn = document.getElementById("undo-prayer-btn");

  bibleTab.addEventListener("click", () => switchMode("bible"));
  prayerTab.addEventListener("click", () => switchMode("prayer"));
  prayerCopyBtn.addEventListener("click", copyPrayerToClipboard);
  prayerSaveBtn.addEventListener("click", savePrayerText);
  if (enhanceBtn) enhanceBtn.addEventListener("click", enhancePrayerWithAI);
  if (undoBtn) undoBtn.addEventListener("click", undoPrayerEnhancement);

  loadPrayerTabsFromStorage();

  let saveTimeout = null;
  prayerTextarea.addEventListener("input", () => {
    updatePrayerPreview();
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (!isEnhancingPrayer) savePrayerText();
    }, 800);
  });

  updatePrayerSignatureDisplay();

 initPrayerSplitter();
}

function updatePrayerSignatureDisplay() {
  const el = document.getElementById("prayer-signature");
  if (el) el.textContent = getPrayerSignature();
}

window.updatePrayerSignatureDisplay = updatePrayerSignatureDisplay;

bootstrap();
