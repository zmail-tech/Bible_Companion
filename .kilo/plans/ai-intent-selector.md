# AI Intent Selector Implementation

## Overview

Replace the single "Send to AI" prompt with a configurable intent selector, allowing users to choose from 7 analysis types. Selection persists via `localStorage`.

## Files to Modify

1. `index.html` — Add dropdown UI
2. `css/app.css` — Style the new dropdown
3. `js/app.js` — Add prompt dictionary, selection logic, updated `sendToAI`

## Detailed Changes

### 1. `index.html` — Add AI Intent Dropdown

In the `<nav id="navigation-bar">`, inside `.nav-actions` (line 51-59), add a new nav-group for intent selection right before the "Send to AI" button. The structure:

```html
<div class="nav-actions">
  <div class="nav-group">
    <label for="intent-select">AI Intent</label>
    <select id="intent-select">
      <option value="commentary">Commentary</option>
      <option value="reference">Reference Verses</option>
      <option value="context">Context &amp; Background</option>
      <option value="wordstudy">Word Study</option>
      <option value="application">Modern Application</option>
      <option value="questions">Study Questions</option>
      <option value="summary">Summary</option>
    </select>
  </div>
  <button id="send-to-ai" class="btn-primary" disabled ...>...</button>
</div>
```

Wrap the existing `<button id="send-to-ai">...</button>` inside the same `.nav-actions` div alongside the new selector.

### 2. `css/app.css` — Style the Dropdown

Add styles for the intent selector to match the existing `.nav-group select` style (already defined at line 217-233). The existing `.nav-group` and `select` styles should work as-is since we're reusing the same classes. No additional CSS is needed beyond potentially adjusting `.nav-actions` to display as flex with a gap so the dropdown and button sit side by side.

Update `.nav-actions` from `margin-left: auto` only to also include `display: flex; gap: 0.5rem;` so both the selector and button sit correctly.

### 3. `js/app.js` — Core Logic

#### 3a. Prompt Dictionary (Top of file, after `SYSTEM_PROMPT`)

Add a constant mapping intent keys to instruction strings:

```js
const INTENT_PROMPTS = {
  commentary: "Provide a detailed theological commentary on the selected passage. Use Southern Baptist theological perspectives and explain the text clearly.",
  reference: "Identify and list 5 key cross-reference verses that support, quote, or allude to the selected passage. Provide a brief explanation of the connection for each.",
  context: "Analyze the historical context of this passage. Specifically detail the Author, the intended Audience, the Historical Setting, and any relevant cultural customs.",
  wordstudy: "Perform a linguistic analysis of the passage. Identify key Hebrew or Greek words, their original meanings, and how they inform the translation.",
  application: "Explain the practical application of this passage. How does this teaching apply to a modern believer's life, relationships, or work?",
  questions: "Generate 5 thoughtful discussion questions based on this passage suitable for a Bible study or small group.",
  summary: "Provide a concise, one-paragraph summary of the main points and themes of this passage."
};
```

Default intent key: `const DEFAULT_INTENT = "commentary";`

#### 3b. Initialize Intent Selector (`startApp`)

In `startApp()` (line 102), add `initIntentSelector()` after `bindKeyboardShortcuts()`.

#### 3c. `initIntentSelector` Function

```js
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
```

#### 3d. Update `sendToAI` Function (line 379)

Replace the hardcoded user message on line 394:

**Before:**
```js
{ role: "user", content: `Provide commentary on the following passage:\n\n${selectedText}` }
```

**After:**
```js
const intent = document.getElementById("intent-select").value || DEFAULT_INTENT;
const promptString = INTENT_PROMPTS[intent] || INTENT_PROMPTS[DEFAULT_INTENT];
const finalPrompt = `${promptString}\n\nHere is the text to analyze:\n"${selectedText}"`;
// Then use:
{ role: "user", content: finalPrompt }
```

Also update the loading message on line 388 to be dynamic based on intent:
```js
responseEl.innerHTML = `<span class="loading-spinner"></span> Loading ${intent}...`;
```

#### 3e. Update AI Panel Header

Optional: Dynamically update `#ai-header h2` to reflect the current intent when `sendToAI` runs. e.g., change "AI Commentary" to "AI: Commentary" or "AI: Word Study".

```js
const intentLabel = select.options[select.selectedIndex].text;
document.querySelector("#ai-header h2").textContent = `AI: ${intentLabel}`;
```

### Summary of Touch Points

| File | Lines | Change |
|------|-------|--------|
| `index.html` | 51-59 | Add `<select id="intent-select">` in `.nav-actions` |
| `css/app.css` | 236 | Update `.nav-actions` to `display: flex; gap: 0.5rem` |
| `js/app.js` | ~20 | Add `INTENT_PROMPTS` dict and `DEFAULT_INTENT` constant |
| `js/app.js` | ~108 | Add `initIntentSelector()` call in `startApp()` |
| `js/app.js` | New | Add `initIntentSelector()` function |
| `js/app.js` | 379-396 | Update `sendToAI()` to use selected intent |
