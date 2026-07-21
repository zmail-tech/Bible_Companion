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
import { loadSettingsLocally, getActiveProvider, getCommentaryModel, getPrayerModel, getSmallModel, getPrayerSignature, getEmailSubject, getEmailGreeting, setCommentaryModel, getCommentaryVerbosity, setCommentaryVerbosity, buildAggregatedModelList, getSettings } from "./settings.js";

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
let isReviewMode = false;

/* --- Review Mode State --- */

let reviewPassages = [];
let quizQuestions = [];
let currentQuestionIndex = 0;
let quizAnswers = {};
let quizScore = { correct: 0, total: 0 };
let selectedChoiceIndex = null;

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
    chatHistory: [],
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
  if (tab.chatHistory && tab.chatHistory.length > 0) {
    responseEl.innerHTML = "";
    for (const entry of tab.chatHistory) {
      if (entry.role === "user") {
        const userMsg = document.createElement("div");
        userMsg.className = "ai-user-message";
        userMsg.textContent = entry.content;
        responseEl.appendChild(userMsg);
      } else if (entry.role === "assistant") {
        const asstMsg = document.createElement("div");
        asstMsg.className = "ai-assistant-message";
        asstMsg.innerHTML = renderMarkdown(entry.content);
        responseEl.appendChild(asstMsg);
      }
    }
    responseEl.scrollTop = responseEl.scrollHeight;
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
        chatHistory: [],
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
    recipients: "",
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
  updateRecipientsButton();
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
      prayerTabs = data.map(t => ({ ...t, recipients: t.recipients || "" }));
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
    prayerTabs = [{ id: 1, name: "General", content: oldData, recipients: "" }];
    activePrayerTabId = 1;
    nextPrayerTabId = 2;
    localStorage.removeItem(PRAYER_STORAGE_KEY);
    savePrayerTabsToStorage();
    return true;
  }

  // Default empty tab
  prayerTabs = [{ id: 1, name: "General", content: "", recipients: "" }];
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

  const radios = document.querySelectorAll('.ai-verbosity-row input[name="verbosity"]');
  const savedVerbosity = getCommentaryVerbosity();
  radios.forEach(radio => {
    radio.checked = radio.value === savedVerbosity;
    radio.addEventListener("change", () => {
      setCommentaryVerbosity(radio.value);
    });
  });
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
  initAiInput();

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

  const disclaimer = document.createElement("div");
  disclaimer.className = "bible-source-note";
  disclaimer.textContent = "Note: LLMs can and do make mistakes. Always verify important information against the Bible text itself.";
  container.appendChild(disclaimer);

  const bottomNav = document.createElement("div");
  bottomNav.id = "chapter-bottom-nav";
  bottomNav.innerHTML = `
    <button id="bottom-prev-chapter" class="bottom-nav-arrow" aria-label="Previous chapter">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>
    <span id="bottom-chapter-display">${tab.chapter}</span>
    <button id="bottom-next-chapter" class="bottom-nav-arrow" aria-label="Next chapter">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </button>
    <span id="bottom-book-label">${escapeHtml(tab.book)}</span>
  `;
  container.appendChild(bottomNav);

  bottomNav.querySelector("#bottom-prev-chapter").addEventListener("click", () => {
    const tab = getActiveTab();
    if (!tab) return;
    const result = goPrevChapter(tab.book, tab.chapter);
    tab.book = result.book;
    tab.chapter = result.chapter;
    setCurrentBook(tab.book);
    setCurrentChapter(tab.chapter);
    updateBookTrigger();
    updateChapterSelect();
    document.getElementById("chapter-select").value = tab.chapter;
    renderChapter();
    saveTabsToStorage();
    renderTabBar();
    const verseContainer = document.getElementById("verse-container");
    if (verseContainer) verseContainer.scrollTop = 0;
  });

  bottomNav.querySelector("#bottom-next-chapter").addEventListener("click", () => {
    const tab = getActiveTab();
    if (!tab) return;
    const result = goNextChapter(tab.book, tab.chapter);
    tab.book = result.book;
    tab.chapter = result.chapter;
    setCurrentBook(tab.book);
    setCurrentChapter(tab.chapter);
    updateBookTrigger();
    updateChapterSelect();
    document.getElementById("chapter-select").value = tab.chapter;
    renderChapter();
    saveTabsToStorage();
    renderTabBar();
    const verseContainer = document.getElementById("verse-container");
    if (verseContainer) verseContainer.scrollTop = 0;
  });

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

function handleFollowUp() {
  const input = document.getElementById("ai-input");
  if (!input) return;
  const text = input.value.trim();
  if (!text || isLoading) return;
  input.value = "";
  sendToAI(null, text);
}

function handleFollowUpFromText(text) {
  if (!text || isLoading) return;
  sendToAI(null, text);
}

function initAiInput() {
  const sendBtn = document.getElementById("ai-send-btn");
  const input = document.getElementById("ai-input");
  if (sendBtn) {
    sendBtn.addEventListener("click", handleFollowUp);
  }
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleFollowUp();
      }
    });
  }
}

async function sendToAI(intentKey, followUpText) {
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
  try {
    const intent = intentKey || DEFAULT_INTENT;
    const intentLabel = IntentLabels[intent] || IntentLabels[DEFAULT_INTENT];
    const promptString = INTENT_PROMPTS[intent] || INTENT_PROMPTS[DEFAULT_INTENT];
    const finalPrompt = `${promptString}\n\nHere is the text to analyze:\n"${selectedText}"`;

    tab.intent = intent;

    const verbosity = getCommentaryVerbosity();
    const verbosityMap = {
      concise: "Response length: Keep your response brief and to the point. Aim for 2-4 short paragraphs maximum.",
      normal: "Response length: Provide a balanced, moderately detailed response.",
      elaborate: "Response length: Provide a thorough, in-depth response with extensive detail and analysis."
    };
    const verbosityDirective = verbosityMap[verbosity] || verbosityMap.normal;
    const maxTokens = 4096;
    const systemPrompt = `${SYSTEM_PROMPT}\n\n${verbosityDirective}`;

    if (followUpText) {
      tab.chatHistory.push({ role: "user", content: followUpText });
      const userMsg = document.createElement("div");
      userMsg.className = "ai-user-message";
      userMsg.textContent = followUpText;
      responseEl.appendChild(userMsg);
      responseEl.scrollTop = responseEl.scrollHeight;

      const historyEntries = tab.chatHistory.slice(-20);
      const messages = [
        { role: "system", content: systemPrompt },
        ...historyEntries.map(e => ({ role: e.role, content: e.content }))
      ];

      const requestBody = {
        model: commentaryConfig.modelId,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7
      };

      console.log("[ai] AI follow-up request", {
        provider: provider.name,
        model: commentaryConfig.modelId,
        messageCount: requestBody.messages.length,
        maxTokens: requestBody.max_tokens,
        verbosity
      });

      await streamAIResponse(provider, responseEl, statusEl, tab, requestBody);
    } else {
      tab.chatHistory = [];
      document.querySelector("#ai-header h2").textContent = `AI: ${intentLabel}`;
      tab.aiTitle = `AI: ${intentLabel}`;

      responseEl.innerHTML = `<span class="loading-spinner"></span> Loading ${intentLabel}...`;
      statusEl.textContent = "Requesting...";

      const requestBody = {
        model: commentaryConfig.modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: finalPrompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.7
      };

      console.log("[ai] AI request body", {
        provider: provider.name,
        model: commentaryConfig.modelId,
        messageCount: requestBody.messages.length,
        maxTokens: requestBody.max_tokens,
        verbosity
      });

      await streamAIResponse(provider, responseEl, statusEl, tab, requestBody);

      const lastEntry = tab.chatHistory[tab.chatHistory.length - 1];
      if (lastEntry && lastEntry.role === "assistant") {
        await generateFollowUpQuestions(lastEntry.content, responseEl);
      }
    }
  } finally {
    isLoading = false;
  }
}

async function streamAIResponse(provider, responseEl, statusEl, tab, requestBody) {
  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (provider.apiKey) {
      headers["Authorization"] = `Bearer ${provider.apiKey}`;
    }

    const REQUEST_TIMEOUT = 120000;
    const STREAM_IDLE_TIMEOUT = 30000;
    const abortController = new AbortController();
    let activeAbortReason = "";
    const timeoutId = setTimeout(() => {
      activeAbortReason = "Request timed out after 120s";
      abortController.abort();
    }, REQUEST_TIMEOUT);

    headers["Cache-Control"] = "no-cache";

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

      const errP = document.createElement("p");
      errP.style.color = "var(--error)";
      errP.textContent = errMsg;
      responseEl.appendChild(errP);
      statusEl.textContent = "Error";
      tab.aiStatus = "Error";
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let reasoningBuffer = "";
    let buffer = "";

    const streamingEl = document.createElement("div");
    streamingEl.className = "ai-assistant-message streaming-response";
    streamingEl.innerHTML = `<span class="loading-spinner"></span>`;
    responseEl.innerHTML = "";
    responseEl.appendChild(streamingEl);

    statusEl.textContent = "Streaming...";
    tab.aiStatus = "Streaming...";

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
                streamingEl.innerHTML = renderMarkdown(stripThinkingTags(fullText));
                responseEl.scrollTop = responseEl.scrollHeight;
              }
            }
          } catch {
            // Skip unparseable chunks
          }
        }

        resetStreamIdleTimer();
      }

      // Strip thinking tags from content
      let finalText = "";
      if (fullText) {
        finalText = stripThinkingTags(fullText);
      }

      // If regular content is empty but model produced reasoning, use reasoning as fallback
      if (!finalText && reasoningBuffer) {
        finalText = stripThinkingTags(reasoningBuffer);
      }

      if (finalText) {
        streamingEl.innerHTML = renderMarkdown(finalText);
        responseEl.scrollTop = responseEl.scrollHeight;
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
          streamingEl.innerHTML = renderMarkdown(abortFinalText);
          tab.aiStatus = activeAbortReason === "Stream stalled for 30s"
            ? "Streaming interrupted: no stream data for 30s. Partial result shown."
            : "Streaming interrupted: request timed out after 120s. Partial result shown.";
          statusEl.textContent = tab.aiStatus;
        } else {
          streamingEl.innerHTML = '<p style="color: var(--error);">' + escapeHtml(activeAbortReason === "Stream stalled for 30s"
            ? "No response data for 30s. Try again."
            : "Request timed out after 120s. Try again.") + '</p>';
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

    // Recompute finalText for post-stream checks (may have been set in catch block)
    let postStreamText = "";
    if (fullText) {
      postStreamText = stripThinkingTags(fullText);
    }
    if (!postStreamText && reasoningBuffer) {
      postStreamText = stripThinkingTags(reasoningBuffer);
    }

    if (!postStreamText) {
      console.warn("[ai] empty response after streaming", {
        streamedChunks,
        fullTextLength: fullText.length,
        reasoningBufferLength: reasoningBuffer.length,
        model: requestBody.model,
        endpoint: provider.endpoint
      });
      responseEl.innerHTML = '<p class="selection-hint">Received empty response from API. Check console for details.</p>';
    }

    if (postStreamText) {
      tab.chatHistory.push({ role: "assistant", content: postStreamText });
      if (tab.chatHistory.length > 20) {
        tab.chatHistory = tab.chatHistory.slice(-20);
      }
      tab.aiResponse = responseEl.innerHTML;
      tab.aiStatus = "Response ready";
      statusEl.textContent = "Response ready";
    }
  } catch (err) {
    const msg = err.message || "Unknown error";
    let displayMsg = `Request failed: ${msg}`;

    if (err.name === "AbortError") {
      displayMsg = "Request interrupted. Try again.";
    } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      displayMsg = `Network error. This is likely a CORS restriction. Try running through a local proxy, or use an endpoint that allows cross-origin requests.`;
    }

    const errP = document.createElement("p");
    errP.style.color = "var(--error)";
    errP.textContent = displayMsg;
    responseEl.appendChild(errP);
    statusEl.textContent = "Error";
    tab.aiStatus = "Error";
  }
}

async function generateFollowUpQuestions(commentaryText, responseEl) {
  const smallConfig = getSmallModel();
  if (!smallConfig) return;

  const provider = smallConfig.provider;
  const headers = { "Content-Type": "application/json" };
  if (provider.apiKey) {
    headers["Authorization"] = `Bearer ${provider.apiKey}`;
  }

  const prompt = `Read the following Bible commentary carefully. Generate exactly 3 thoughtful follow-up questions a reader might want to ask a theologian about this commentary. Output only the 3 questions, one per line, with no numbering, bullets, or extra text.\n\n${commentaryText}`;

  try {
    console.log("[followup] Generating follow-up questions", { model: smallConfig.modelId, commentaryLength: commentaryText.length });

    const res = await fetch(provider.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: smallConfig.modelId,
        messages: [
          { role: "system", content: "You are a helpful Bible study assistant. Generate concise, thoughtful questions." },
          { role: "user", content: prompt }
        ],
        max_tokens: 1024,
        temperature: 0.3
      })
    });

    if (!res.ok) {
      console.warn("[followup] HTTP error", { status: res.status, statusText: res.statusText });
      return;
    }

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || "";
    if (!content) {
      console.warn("[followup] Empty response content", { choices: data.choices });
      return;
    }

    // Strip thinking/reasoning tags that some models output
    content = stripThinkingTags(content);

    // Parse: split by newlines, strip numbering/bullets, filter empty lines
    let rawLines = content
      .split("\n")
      .map(q => q.replace(/^[\d\-\*\•]+\s*/, "").trim())
      .filter(Boolean);

    console.log("[followup] Raw lines from model", { count: rawLines.length, lines: rawLines });

    // If we got fewer than 3 lines, try splitting on question marks to recover
    // questions that were output on a single line or in a paragraph format
    if (rawLines.length < 3) {
      const joined = rawLines.join(" ");
      rawLines = joined
        .split(/\?(?=\s*(?:[A-Z]|\d|\-|\*|$))/)
        .map(part => part.trim() + "?")
        .filter(Boolean);
      console.log("[followup] After question-mark split", { count: rawLines.length, lines: rawLines });
    }

    // Filter to only lines that look like questions (end with '?' or contain question words)
    const questions = rawLines
      .filter(line => line.endsWith("?") || /\b(why|how|what|who|when|where|which|could|would|should)\b/i.test(line))
      .slice(0, 3);

    console.log("[followup] Filtered questions", { count: questions.length, questions });

    if (questions.length === 0) {
      console.warn("[followup] No valid questions extracted from model response");
      return;
    }

    const container = document.createElement("div");
    container.className = "follow-up-questions";

    for (const q of questions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "follow-up-btn";
      btn.textContent = q;
      btn.addEventListener("click", () => {
        container.remove();
        handleFollowUpFromText(q);
      });
      container.appendChild(btn);
    }

    responseEl.appendChild(container);
    responseEl.scrollTop = responseEl.scrollHeight;
  } catch (err) {
    console.warn("[followup] Exception generating follow-up questions", err);
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
  isReviewMode = mode === "review";
  const bibleReader = document.getElementById("bible-reader");
  const splitter = document.getElementById("splitter");
  const navigationBar = document.getElementById("navigation-bar");
  const aiPanel = document.getElementById("ai-panel");
  const aiIntentBox = document.getElementById("ai-intent-box");
  const prayerEditor = document.getElementById("prayer-editor");
  const reviewPanel = document.getElementById("review-panel");
  const bibleTab = document.getElementById("mode-bible-tab");
  const prayerTab = document.getElementById("mode-prayer-tab");
  const reviewTab = document.getElementById("mode-review-tab");

  bibleTab.classList.toggle("active", mode === "bible");
  prayerTab.classList.toggle("active", mode === "prayer");
  if (reviewTab) reviewTab.classList.toggle("active", mode === "review");

  const tabBar = document.getElementById("tab-bar");

  if (isReviewMode) {
    bibleReader.classList.add("hidden");
    splitter.classList.add("hidden");
    navigationBar.classList.add("hidden");
    aiPanel.classList.add("hidden");
    if (aiIntentBox) aiIntentBox.classList.add("hidden");
    prayerEditor.classList.add("hidden");
    if (reviewPanel) reviewPanel.classList.remove("hidden");
    tabBar.classList.add("hidden");
    renderReviewSetup();
  } else if (isPrayerMode) {
    bibleReader.classList.add("hidden");
    splitter.classList.add("hidden");
    navigationBar.classList.add("hidden");
    aiPanel.classList.add("hidden");
    if (aiIntentBox) aiIntentBox.classList.add("hidden");
    prayerEditor.classList.remove("hidden");
    if (reviewPanel) reviewPanel.classList.add("hidden");
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
    if (reviewPanel) reviewPanel.classList.add("hidden");
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
  const sigHtml = escapeHtml(signature).replace(/\n/g, "<br>");
  const htmlContent = preview.innerHTML + "<p>" + sigHtml + "</p>";
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

function sendPrayerEmail() {
  const tab = getActivePrayerTab();
  if (!tab || !tab.recipients || !tab.recipients.trim()) {
    showPrayerStatus("No recipients configured");
    return;
  }

  const textarea = document.getElementById("prayer-textarea");
  const preview = document.getElementById("prayer-preview");
  const text = textarea.value.trim();
  if (!text) {
    showPrayerStatus("Nothing to copy");
    return;
  }
  const signature = getPrayerSignature();
  const greeting = getEmailGreeting();
  const subject = getEmailSubject();

  let htmlContent = "";
  if (greeting) {
    htmlContent += "<div>" + escapeHtml(greeting).replace(/\n/g, "<br>") + "</div>";
  }
  htmlContent += preview.innerHTML.trim();
  htmlContent = htmlContent.replace(/<(h[1-6])>/g, "<br><$1>");
  htmlContent += "<br><p>" + escapeHtml(signature).replace(/\n/g, "<br>") + "</p>";
  const spacedText = text.replace(/^#+\s/gm, "\n$&").trim();
  const plainText = (greeting ? greeting + "\n" : "") + spacedText + "\n" + signature;

  try {
    if (navigator.clipboard && navigator.clipboard.write) {
      const htmlBlob = new Blob([htmlContent], { type: "text/html" });
      const textBlob = new Blob([plainText], { type: "text/plain" });
      const item = new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob,
      });
      navigator.clipboard.write([item]);
    } else {
      const ta = document.createElement("textarea");
      ta.value = plainText;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch (e) {
        showPrayerStatus("Copy failed");
      } finally {
        document.body.removeChild(ta);
      }
    }
  } catch {
    showPrayerStatus("Copy failed");
  }

  const mailtoUrl = `mailto:${encodeURIComponent(tab.recipients)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(sanitizeHtml(plainText))}`;
  window.location.href = mailtoUrl;
  showPrayerStatus("Prayer list copied to clipboard. Opening email client...");
}

/* --- Review Mode --- */

function parseVerseRange(rangeStr) {
  const parts = rangeStr.split(",");
  const verses = new Set();
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [startStr, endStr] = trimmed.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
        for (let v = start; v <= end; v++) {
          verses.add(v);
        }
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num > 0) {
        verses.add(num);
      }
    }
  }
  return Array.from(verses).sort((a, b) => a - b);
}

function renderReviewSetup() {
  const setupEl = document.getElementById("review-setup");
  const quizEl = document.getElementById("review-quiz");
  if (!setupEl || !quizEl) return;

  if (quizQuestions.length > 0 && currentQuestionIndex < quizQuestions.length) {
    setupEl.style.display = "none";
    quizEl.style.display = "block";
    renderQuiz();
    return;
  }

  setupEl.style.display = "block";
  quizEl.style.display = "none";

  renderPassageSlots();
  updateGenerateButtonState();
}

function renderPassageSlots() {
  const container = document.getElementById("passage-slots");
  if (!container) return;
  container.innerHTML = "";

  if (reviewPassages.length === 0) {
    reviewPassages.push({ book: "", chapter: "", verses: "" });
  }

  reviewPassages.forEach((passage, index) => {
    const slot = createPassageSlot(passage, index);
    container.appendChild(slot);
  });
}

function createPassageSlot(passage, index) {
  const slot = document.createElement("div");
  slot.className = "passage-entry";

  const bookSelect = document.createElement("select");
  bookSelect.className = "passage-book-select";
  bookSelect.innerHTML = '<option value="">Book</option>';
  for (const book of getBooks()) {
    const opt = document.createElement("option");
    opt.value = book;
    opt.textContent = book;
    if (passage.book === book) opt.selected = true;
    bookSelect.appendChild(opt);
  }
  bookSelect.addEventListener("change", () => {
    reviewPassages[index].book = bookSelect.value;
    reviewPassages[index].chapter = "";
    reviewPassages[index].verses = "";
    updateChapterOptions(bookSelect, chapterSelect);
    updateVerseHint(verseInput);
    updateGenerateButtonState();
  });

  const chapterSelect = document.createElement("select");
  chapterSelect.className = "passage-chapter-select";
  chapterSelect.innerHTML = '<option value="">Chapter</option>';
  if (passage.book) {
    const maxCh = getChaptersForBook(passage.book);
    for (let c = 1; c <= maxCh; c++) {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      if (passage.chapter === String(c)) opt.selected = true;
      chapterSelect.appendChild(opt);
    }
  }
  chapterSelect.addEventListener("change", () => {
    reviewPassages[index].chapter = chapterSelect.value;
    updateVerseHint(verseInput);
    updateGenerateButtonState();
  });

  const verseInput = document.createElement("input");
  verseInput.type = "text";
  verseInput.className = "passage-verse-input";
  verseInput.placeholder = "Verses (e.g. 1-5, 3,7)";
  verseInput.value = passage.verses || "";
  verseInput.addEventListener("input", () => {
    reviewPassages[index].verses = verseInput.value;
    updateGenerateButtonState();
  });

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-secondary passage-remove-btn";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => {
    reviewPassages.splice(index, 1);
    if (reviewPassages.length === 0) {
      reviewPassages.push({ book: "", chapter: "", verses: "" });
    }
    renderPassageSlots();
    updateGenerateButtonState();
  });

  slot.appendChild(bookSelect);
  slot.appendChild(chapterSelect);
  slot.appendChild(verseInput);
  slot.appendChild(removeBtn);

  updateVerseHint(verseInput);

  return slot;
}

function updateChapterOptions(bookSelect, chapterSelect) {
  chapterSelect.innerHTML = '<option value="">Chapter</option>';
  const book = bookSelect.value;
  if (!book) return;
  const maxCh = getChaptersForBook(book);
  for (let c = 1; c <= maxCh; c++) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    chapterSelect.appendChild(opt);
  }
}

function updateVerseHint(verseInput) {
  const slot = verseInput.parentElement;
  const bookSelect = slot.querySelector(".passage-book-select");
  const chapterSelect = slot.querySelector(".passage-chapter-select");
  const book = bookSelect.value;
  const chapter = chapterSelect.value;
  let hint = "Verses (e.g. 1-5, 3,7)";
  if (book && chapter) {
    const verses = getChapter(book, parseInt(chapter, 10));
    if (verses && verses.length > 0) {
      hint = `Verses (1-${verses.length}, e.g. 1-5, 3,7)`;
    }
  }
  verseInput.placeholder = hint;
}

function updateGenerateButtonState() {
  const btn = document.getElementById("generate-quiz-btn");
  if (!btn) return;
  const valid = reviewPassages.some(p => p.book && p.chapter && p.verses);
  btn.disabled = !valid;
}

function validatePassages() {
  const errorEl = document.getElementById("review-error");
  if (errorEl) errorEl.style.display = "none";

  const validated = [];
  for (const p of reviewPassages) {
    if (!p.book || !p.chapter || !p.verses) continue;
    const chapterNum = parseInt(p.chapter, 10);
    const verses = parseVerseRange(p.verses);
    if (verses.length === 0) {
      showReviewError(`Invalid verse range "${p.verses}" for ${p.book} ${p.chapter}.`);
      return null;
    }
    const chapterVerses = getChapter(p.book, chapterNum);
    if (!chapterVerses) {
      showReviewError(`Could not load ${p.book} chapter ${chapterNum}.`);
      return null;
    }
    const maxVerse = chapterVerses.length;
    const clamped = verses.filter(v => v <= maxVerse).slice(0, 100);
    if (clamped.length === 0) {
      showReviewError(`No valid verses in range "${p.verses}" for ${p.book} ${p.chapter} (max verse: ${maxVerse}).`);
      return null;
    }
    validated.push({ book: p.book, chapter: chapterNum, verses: clamped });
  }

  if (validated.length === 0) {
    showReviewError("Please select at least one valid passage.");
    return null;
  }
  return validated;
}

function showReviewError(msg) {
  const errorEl = document.getElementById("review-error");
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }
}

function buildPassageText(validated) {
  const parts = [];
  for (const p of validated) {
    const verses = getChapter(p.book, p.chapter);
    if (!verses) continue;
    const verseMap = {};
    for (const v of verses) {
      verseMap[v.number] = v.text;
    }
    const ref = formatReference(p.book, p.chapter, "");
    parts.push(`=== ${ref} ===`);
    for (const vNum of p.verses) {
      const text = verseMap[vNum];
      if (text) {
        parts.push(`Verse ${vNum}: ${text}`);
      }
    }
    parts.push("");
  }
  return parts.join("\n");
}

async function generateQuiz() {
  const validated = validatePassages();
  if (!validated) return;

  const passageText = buildPassageText(validated);
  const smallConfig = getSmallModel();
  if (!smallConfig) {
    showReviewError("Small model not configured. Please set a Small Model in Settings.");
    return;
  }

  const provider = smallConfig.provider;
  const headers = { "Content-Type": "application/json" };
  if (provider.apiKey) {
    headers["Authorization"] = `Bearer ${provider.apiKey}`;
  }

  const countInput = document.getElementById("quiz-count-input");
  const questionCount = Math.min(Math.max(parseInt(countInput?.value || "10", 10) || 10, 1), 50);

  const prompt = `Generate exactly ${questionCount} multiple-choice quiz questions based on these Bible passages. Each question must have exactly 4 answer choices, with only one correct answer. Format each question as follows:

Q: [question text]
A: [choice 1 text]
B: [choice 2 text]
C: [choice 3 text]
D: [choice 4 text]
ANSWER: [single letter A, B, C, or D indicating the correct choice]

Do not include any extra text, numbering, or explanation. Make the wrong choices plausible but clearly incorrect based on the passages.

PASSAGES:
${passageText}`;

  const generateBtn = document.getElementById("generate-quiz-btn");
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating...";
  }

  try {
    const res = await fetch(provider.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: smallConfig.modelId,
        messages: [
          { role: "system", content: "You are a Bible quiz generator. Output multiple-choice questions in Q:/A:/B:/C:/D:/ANSWER: format only." },
          { role: "user", content: prompt }
        ],
        max_tokens: 4096,
        temperature: 0.5
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || "";
    content = stripThinkingTags(content);

    const parsed = parseQuizResponse(content);

    if (parsed.length < 3) {
      if (parsed.length > 0) {
        if (!confirm(`Only ${parsed.length} questions generated. Continue anyway?`)) {
          return;
        }
      } else {
        showReviewError("Failed to generate quiz questions. Please try again.");
        return;
      }
    }

    quizQuestions = parsed;
    currentQuestionIndex = 0;
    quizAnswers = {};
    quizScore = { correct: 0, total: 0 };
    saveReviewState();
    renderQuiz();
  } catch (err) {
    showReviewError(`Quiz generation failed: ${err.message}`);
  } finally {
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate Quiz";
    }
  }
}

function parseQuizResponse(content) {
  const questions = [];
  const lines = content.split("\n");
  let currentQuestion = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("Q:") || trimmed.startsWith("Q: ")) {
      if (currentQuestion && currentQuestion.question && currentQuestion.choices && currentQuestion.choices.length === 4 && currentQuestion.correctIndex !== null) {
        questions.push(currentQuestion);
      }
      currentQuestion = {
        question: trimmed.replace(/^Q:\s*/, ""),
        choices: [],
        correctIndex: null
      };
    } else if (trimmed.startsWith("A:") || trimmed.startsWith("A: ")) {
      if (currentQuestion && currentQuestion.choices.length < 4) {
        currentQuestion.choices.push(trimmed.replace(/^A:\s*/, ""));
      }
    } else if (trimmed.startsWith("B:") || trimmed.startsWith("B: ")) {
      if (currentQuestion && currentQuestion.choices.length < 4) {
        currentQuestion.choices.push(trimmed.replace(/^B:\s*/, ""));
      }
    } else if (trimmed.startsWith("C:") || trimmed.startsWith("C: ")) {
      if (currentQuestion && currentQuestion.choices.length < 4) {
        currentQuestion.choices.push(trimmed.replace(/^C:\s*/, ""));
      }
    } else if (trimmed.startsWith("D:") || trimmed.startsWith("D: ")) {
      if (currentQuestion && currentQuestion.choices.length < 4) {
        currentQuestion.choices.push(trimmed.replace(/^D:\s*/, ""));
      }
    } else if ((trimmed.startsWith("ANSWER:") || trimmed.startsWith("ANSWER: ")) && currentQuestion) {
      const letter = trimmed.replace(/^ANSWER:\s*/, "").toUpperCase();
      const idx = letter.charCodeAt(0) - 65;
      if (idx >= 0 && idx <= 3) {
        currentQuestion.correctIndex = idx;
      }
    } else if (currentQuestion && currentQuestion.choices.length < 4) {
      const lastChoice = currentQuestion.choices[currentQuestion.choices.length - 1];
      if (lastChoice) {
        currentQuestion.choices[currentQuestion.choices.length - 1] += " " + trimmed;
      } else {
        currentQuestion.question += " " + trimmed;
      }
    }
  }

  if (currentQuestion && currentQuestion.question && currentQuestion.choices.length === 4 && currentQuestion.correctIndex !== null) {
    questions.push(currentQuestion);
  }

  return questions.filter(q => q.question && q.choices && q.choices.length === 4 && q.correctIndex !== null);
}

function renderQuiz() {
  const setupEl = document.getElementById("review-setup");
  const quizEl = document.getElementById("review-quiz");
  if (!setupEl || !quizEl) return;

  setupEl.style.display = "none";
  quizEl.style.display = "block";

  const progressEl = document.getElementById("quiz-progress");
  if (progressEl) {
    progressEl.textContent = `Question ${currentQuestionIndex + 1} of ${quizQuestions.length}`;
  }

  const questionEl = document.getElementById("quiz-question");
  if (questionEl) {
    questionEl.textContent = quizQuestions[currentQuestionIndex].question;
  }

  const choicesContainer = document.getElementById("quiz-choices");
  if (choicesContainer) {
    const q = quizQuestions[currentQuestionIndex];
    const labels = ["A", "B", "C", "D"];
    choicesContainer.innerHTML = "";
    choicesContainer.style.display = "block";
    choicesContainer.disabled = false;

    q.choices.forEach((choice, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-choice-btn";
      btn.textContent = `${labels[idx]}. ${choice}`;
      btn.dataset.index = idx;
      btn.addEventListener("click", () => selectChoice(idx));
      choicesContainer.appendChild(btn);
    });
  }

  const resultEl = document.getElementById("quiz-result");
  if (resultEl) resultEl.style.display = "none";

  const submitBtn = document.getElementById("quiz-submit-btn");
  if (submitBtn) {
    submitBtn.style.display = "inline-block";
    submitBtn.disabled = true;
  }

  const nextBtn = document.getElementById("quiz-next-btn");
  if (nextBtn) nextBtn.style.display = "none";

  const restartBtn = document.getElementById("quiz-restart-btn");
  if (restartBtn) restartBtn.style.display = "none";

  const resetBtn = document.getElementById("quiz-reset-btn");
  if (resetBtn) resetBtn.style.display = "inline-block";

  const scoreSummary = document.getElementById("quiz-score-summary");
  if (scoreSummary) scoreSummary.style.display = "none";

  selectedChoiceIndex = null;
}

function selectChoice(idx) {
  const choicesContainer = document.getElementById("quiz-choices");
  if (!choicesContainer) return;

  selectedChoiceIndex = idx;

  const buttons = choicesContainer.querySelectorAll(".quiz-choice-btn");
  buttons.forEach((btn, i) => {
    btn.classList.toggle("selected", i === idx);
  });

  const submitBtn = document.getElementById("quiz-submit-btn");
  if (submitBtn) {
    submitBtn.style.display = "inline-block";
    submitBtn.disabled = false;
  }
}

function submitQuizAnswer() {
  const choicesContainer = document.getElementById("quiz-choices");
  const resultEl = document.getElementById("quiz-result");
  const nextBtn = document.getElementById("quiz-next-btn");

  if (selectedChoiceIndex === null) return;

  const q = quizQuestions[currentQuestionIndex];
  quizAnswers[currentQuestionIndex] = selectedChoiceIndex;

  const correct = selectedChoiceIndex === q.correctIndex;
  if (correct) {
    quizScore.correct++;
  }
  quizScore.total++;

  const buttons = choicesContainer.querySelectorAll(".quiz-choice-btn");
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correctIndex) {
      btn.classList.add("correct");
    } else if (i === selectedChoiceIndex && !correct) {
      btn.classList.add("incorrect");
    }
  });
  choicesContainer.disabled = true;

  if (resultEl) {
    resultEl.style.display = "block";
    resultEl.className = `quiz-result ${correct ? "correct" : "incorrect"}`;
    const labels = ["A", "B", "C", "D"];
    resultEl.innerHTML = `<div class="result-status">${correct ? "Correct!" : "Incorrect"}</div>
      <div class="result-answer">Answer: ${labels[q.correctIndex]}. ${escapeHtml(q.choices[q.correctIndex])}</div>
      ${!correct ? `<div class="result-user">Your answer: ${labels[selectedChoiceIndex]}. ${escapeHtml(q.choices[selectedChoiceIndex])}</div>` : ""}`;
  }

  const submitBtnEl = document.getElementById("quiz-submit-btn");
  if (submitBtnEl) submitBtnEl.style.display = "none";
  if (nextBtn) nextBtn.style.display = "inline-block";

  saveReviewState();
}

function nextQuizQuestion() {
  currentQuestionIndex++;

  if (currentQuestionIndex >= quizQuestions.length) {
    showScoreSummary();
  } else {
    renderQuiz();
  }
}

function showScoreSummary() {
  const progressEl = document.getElementById("quiz-progress");
  const questionEl = document.getElementById("quiz-question");
  const choicesContainer = document.getElementById("quiz-choices");
  const resultEl = document.getElementById("quiz-result");
  const submitBtn = document.getElementById("quiz-submit-btn");
  const nextBtn = document.getElementById("quiz-next-btn");
  const restartBtn = document.getElementById("quiz-restart-btn");
  const resetBtn = document.getElementById("quiz-reset-btn");
  const scoreSummary = document.getElementById("quiz-score-summary");

  if (progressEl) progressEl.textContent = "Quiz Complete";
  if (questionEl) questionEl.textContent = "";
  if (choicesContainer) choicesContainer.style.display = "none";
  if (resultEl) resultEl.style.display = "none";
  if (submitBtn) submitBtn.style.display = "none";
  if (nextBtn) nextBtn.style.display = "none";
  if (restartBtn) restartBtn.style.display = "inline-block";
  if (resetBtn) resetBtn.style.display = "inline-block";

  if (scoreSummary) {
    const pct = quizScore.total > 0 ? Math.round((quizScore.correct / quizScore.total) * 100) : 0;
    const labels = ["A", "B", "C", "D"];
    scoreSummary.style.display = "block";
    scoreSummary.innerHTML = `<h3>Quiz Results</h3>
      <p class="score-number">${quizScore.correct} / ${quizScore.total} (${pct}%)</p>
      <div class="score-details">
        ${quizQuestions.map((q, i) => {
          const userChoice = quizAnswers[i];
          const wasCorrect = userChoice !== null && userChoice === q.correctIndex;
          return `<div class="score-item ${wasCorrect ? "correct" : "incorrect"}">
            <span class="score-icon">${wasCorrect ? "\u2713" : "\u2717"}</span>
            <span class="score-q">${escapeHtml(q.question)}</span>
            <span class="score-a">${wasCorrect ? "" : `Correct: ${labels[q.correctIndex]}. ${escapeHtml(q.choices[q.correctIndex])}`}</span>
          </div>`;
        }).join("")}
      </div>`;
  }

  saveReviewState();
}

function resetQuiz() {
  reviewPassages = [];
  quizQuestions = [];
  currentQuestionIndex = 0;
  quizAnswers = {};
  quizScore = { correct: 0, total: 0 };
  selectedChoiceIndex = null;
  clearReviewState();
  renderReviewSetup();
}

function checkAnswer(userAnswer, correctAnswer) {
  const normalize = (s) => s.toLowerCase().trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
  const user = normalize(userAnswer);
  const correct = normalize(correctAnswer);

  if (user === correct) return true;

  const correctWords = correct.split(" ").filter(w => w.length > 2);
  if (correctWords.length === 0) return user.length > 0;

  const matchCount = correctWords.filter(w => user.includes(w)).length;
  return matchCount >= Math.ceil(correctWords.length * 0.6);
}

/* --- Review Mode Persistence --- */

function saveReviewState() {
  try {
    const state = {
      passages: reviewPassages,
      questions: quizQuestions,
      currentIndex: currentQuestionIndex,
      answers: quizAnswers,
      score: quizScore
    };
    localStorage.setItem("bibleCompanion_reviewState", JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save review state:", e);
  }
}

function loadReviewState() {
  try {
    const raw = localStorage.getItem("bibleCompanion_reviewState");
    if (!raw) return false;
    const state = JSON.parse(raw);
    reviewPassages = state.passages || [];
    quizQuestions = state.questions || [];
    currentQuestionIndex = state.currentIndex || 0;
    quizAnswers = state.answers || {};
    quizScore = state.score || { correct: 0, total: 0 };
    return quizQuestions.length > 0;
  } catch (e) {
    console.warn("Failed to load review state:", e);
    return false;
  }
}

function clearReviewState() {
  try {
    localStorage.removeItem("bibleCompanion_reviewState");
  } catch (e) {
    // ignore
  }
}

/* --- Review Mode --- */

function initReviewMode() {
  const addPassageBtn = document.getElementById("add-passage-btn");
  const generateQuizBtn = document.getElementById("generate-quiz-btn");
  const submitBtn = document.getElementById("quiz-submit-btn");
  const nextBtn = document.getElementById("quiz-next-btn");
  const restartBtn = document.getElementById("quiz-restart-btn");

  if (addPassageBtn) {
    addPassageBtn.addEventListener("click", () => {
      if (reviewPassages.length < 10) {
        reviewPassages.push({ book: "", chapter: "", verses: "" });
        renderPassageSlots();
        updateGenerateButtonState();
      }
    });
  }

  if (generateQuizBtn) {
    generateQuizBtn.addEventListener("click", generateQuiz);
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", submitQuizAnswer);
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", nextQuizQuestion);
  }

  if (restartBtn) {
    restartBtn.addEventListener("click", resetQuiz);
  }

  const resetBtn = document.getElementById("quiz-reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetQuiz);
  }

  document.addEventListener("keydown", (e) => {
    if (isReviewMode && quizQuestions.length > 0 && currentQuestionIndex < quizQuestions.length) {
      const resultEl = document.getElementById("quiz-result");
      const answered = resultEl && resultEl.style.display !== "none";
      const key = e.key.toLowerCase();

      if (!answered && ["a", "b", "c", "d"].includes(key)) {
        e.preventDefault();
        const idx = key.charCodeAt(0) - 97;
        selectChoice(idx);
        submitQuizAnswer();
      } else if (answered && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        nextQuizQuestion();
      }
    }
  });

  const hasActiveQuiz = loadReviewState();
  if (hasActiveQuiz) {
    // Quiz was in progress, will restore when user switches to review mode
  }
}

function initPrayerMode() {
  const bibleTab = document.getElementById("mode-bible-tab");
  const prayerTab = document.getElementById("mode-prayer-tab");
  const prayerTextarea = document.getElementById("prayer-textarea");
  const prayerCopyBtn = document.getElementById("prayer-copy-btn");
  const prayerSaveBtn = document.getElementById("prayer-save-btn");
  const prayerSendEmailBtn = document.getElementById("prayer-send-email-btn");
  const enhanceBtn = document.getElementById("enhance-prayer-btn");
  const undoBtn = document.getElementById("undo-prayer-btn");

  bibleTab.addEventListener("click", () => switchMode("bible"));
  prayerTab.addEventListener("click", () => switchMode("prayer"));
  const reviewTab = document.getElementById("mode-review-tab");
  if (reviewTab) reviewTab.addEventListener("click", () => switchMode("review"));
  initReviewMode();
  prayerCopyBtn.addEventListener("click", copyPrayerToClipboard);
  prayerSaveBtn.addEventListener("click", savePrayerText);
  if (prayerSendEmailBtn) prayerSendEmailBtn.addEventListener("click", sendPrayerEmail);
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

  if (typeof initPrayerSplitter === "function") initPrayerSplitter();
  initRecipients();
}

function updatePrayerSignatureDisplay() {
  const el = document.getElementById("prayer-signature");
  if (el) el.textContent = getPrayerSignature();
}

window.updatePrayerSignatureDisplay = updatePrayerSignatureDisplay;
window.handleFollowUpFromText = handleFollowUpFromText;

/* --- Recipients --- */

function getRecipientsCount(recipientsStr) {
  if (!recipientsStr || !recipientsStr.trim()) return 0;
  return recipientsStr.split(",").filter(e => e.trim()).length;
}

function updateRecipientsButton() {
  const btn = document.getElementById("prayer-recipients-btn");
  if (!btn) return;
  const tab = getActivePrayerTab();
  const count = tab ? getRecipientsCount(tab.recipients) : 0;
  const span = btn.querySelector("span");
  if (span) {
    span.textContent = count > 0 ? `Recipients (${count})` : "Recipients";
  }
}

function renderRecipientsList() {
  const textarea = document.getElementById("recipients-textarea");
  const listEl = document.getElementById("recipients-list");
  if (!textarea || !listEl) return;
  const emails = textarea.value.split(",").map(e => e.trim()).filter(e => e);
  listEl.innerHTML = "";
  emails.forEach((email, index) => {
    const item = document.createElement("div");
    item.className = "recipient-item";
    const text = document.createElement("span");
    text.className = "recipient-email";
    text.textContent = email;
    const removeBtn = document.createElement("button");
    removeBtn.className = "icon-btn recipient-remove";
    removeBtn.setAttribute("aria-label", "Remove " + email);
    removeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    removeBtn.addEventListener("click", () => removeEmail(index));
    item.appendChild(text);
    item.appendChild(removeBtn);
    listEl.appendChild(item);
  });
}

function addSingleEmail() {
  const input = document.getElementById("recipients-single-input");
  const textarea = document.getElementById("recipients-textarea");
  if (!input || !textarea) return;
  const email = input.value.trim();
  if (!email) return;
  if (textarea.value.trim()) {
    textarea.value = textarea.value + ", " + email;
  } else {
    textarea.value = email;
  }
  renderRecipientsList();
  input.value = "";
  input.focus();
}

function removeEmail(index) {
  const textarea = document.getElementById("recipients-textarea");
  if (!textarea) return;
  const emails = textarea.value.split(",").map(e => e.trim()).filter(e => e);
  emails.splice(index, 1);
  textarea.value = emails.join(", ");
  renderRecipientsList();
}

function openRecipientsModal() {
  const modal = document.getElementById("recipients-modal");
  const textarea = document.getElementById("recipients-textarea");
  const tab = getActivePrayerTab();
  if (modal) {
    if (tab) textarea.value = tab.recipients || "";
    renderRecipientsList();
    modal.classList.add("active");
  }
}

function closeRecipientsModal() {
  const modal = document.getElementById("recipients-modal");
  if (modal) modal.classList.remove("active");
}

function saveRecipients() {
  const textarea = document.getElementById("recipients-textarea");
  const tab = getActivePrayerTab();
  if (!tab || !textarea) return;
  const raw = textarea.value.trim();
  if (raw) {
    const emails = raw.split(",").map(e => e.trim()).filter(e => e);
    tab.recipients = emails.join(", ");
  } else {
    tab.recipients = "";
  }
  savePrayerTabsToStorage();
  updateRecipientsButton();
  closeRecipientsModal();
}

function initRecipients() {
  const openBtn = document.getElementById("prayer-recipients-btn");
  const closeBtn = document.getElementById("close-recipients");
  const saveBtn = document.getElementById("recipients-save-btn");
  const cancelBtn = document.getElementById("recipients-cancel-btn");
  const addBtn = document.getElementById("recipients-add-btn");
  const modal = document.getElementById("recipients-modal");

  if (openBtn) openBtn.addEventListener("click", openRecipientsModal);
  if (closeBtn) closeBtn.addEventListener("click", closeRecipientsModal);
  if (saveBtn) saveBtn.addEventListener("click", saveRecipients);
  if (cancelBtn) cancelBtn.addEventListener("click", closeRecipientsModal);
  if (addBtn) addBtn.addEventListener("click", addSingleEmail);
  if (modal) {
    modal.querySelector(".modal-overlay").addEventListener("click", closeRecipientsModal);
  }
}

bootstrap();
