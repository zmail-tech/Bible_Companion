# Plan: Model Discovery & Selection in Settings

## Overview

Replace the free-text model input with a model discovery feature: a "Fetch Models" button that queries the endpoint's `/v1/models` API, populates a dropdown, and persists the list. On failure, fall back to a text input.

## Changes

### 1. HTML (`index.html`) -- Model field UI

Replace the current model form-group (lines 119-123) with:

```html
<div class="form-group">
  <label for="model-name">Model</label>
  <div class="model-selector-row">
    <select id="model-select" style="display:none;">
      <option value="">-- Select a model --</option>
    </select>
    <input type="text" id="model-name" style="display:none;" placeholder="gpt-4o">
    <button type="button" id="fetch-models-btn" title="Fetch available models" class="icon-btn-models">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
    </button>
  </div>
  <small class="form-hint">Fetch models from your endpoint, or type a model name manually.</small>
</div>
```

### 2. CSS (`css/app.css`) -- New styles

Add styles for `.model-selector-row`:
- Flexbox row layout for select/input + button
- The fetch button styled inline with the input (right-aligned, compact)
- Keep existing form input styles on the select

### 3. JavaScript (`js/settings.js`) -- Core logic

#### New state

```js
let availableModels = [];  // In-memory list from last fetch
```

#### New functions

**`deriveModelsUrl(endpointUrl)`** -- Extract base URL from endpoint and append `/v1/models`. Example: `https://api.openai.com/v1/chat/completions` -> `https://api.openai.com/v1/models`. Handles cases where endpoint already ends with `/models`.

**`fetchModels(endpoint, apiKey)`** -- GET request to `/v1/models` with auth header. Parses response `{ data: [{ id: "...", ... }] }`. Returns array of model IDs. On error, returns `null`.

**`populateModelSelect(models)`** -- Clears `#model-select`, adds each model ID as an `<option>`. Sets `availableModels`.

**`switchToSelectMode()` / `switchToInputMode()`** -- Toggle visibility between `#model-select` and `#model-name`. Select mode shows dropdown, input mode shows text field.

**`saveModelFromUI()`** -- Reads the current value from whichever UI is active (select or input) and updates `settings.model`.

#### Wires up `#fetch-models-btn`

1. Show "Fetching..." status
2. Derive models URL from current endpoint value (or from `settings.endpoint` if blank)
3. Call `fetchModels()` with API key
4. On success: persist to `localStorage["bibleCompanion_models"]`, populate select, switch to select mode, show success status
5. On failure: switch to input mode, show error status

#### On modal open (`openModal`)

1. Check `localStorage["bibleCompanion_models"]` for cached models
2. If cached models exist AND endpoint hasn't changed, populate select and switch to select mode
3. Otherwise, show input mode with current `settings.model`
4. After populating select, set its value to match `settings.model`

#### On form submit

Include `saveModelFromUI()` before persisting settings, so the model from the select (if active) is captured.

#### On reset

Clear `availableModels`, clear cached models from localStorage, reset to default model.

## Storage key

`localStorage["bibleCompanion_models"]` stores `{ endpoint: "...", models: ["model1", "model2", ...] }` so we can invalidate when endpoint changes.

## Data flow

```
User enters endpoint -> clicks "Fetch Models"
  -> deriveModelsUrl(endpoint)
  -> GET /v1/models (with api key)
  -> parse model IDs
  -> populate <select#model-select>
  -> switch visibility: select ON, input OFF
  -> persist to localStorage

User selects model from dropdown -> clicks "Save"
  -> saveModelFromUI() reads select value
  -> settings.model = selected value
  -> localStorage["bibleCompanion_settings"] updated

Next page load:
  -> settings loaded from localStorage
  -> cached models loaded from localStorage
  -> if endpoint matches, populate select
  -> user can toggle model anytime in settings
```
