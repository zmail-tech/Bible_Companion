# Plan: Two-Model Dropdowns for Commentary and Prayer

## Overview

Replace the current toggle/radio/endpoint-based model configuration with two clean dropdowns in the Models pane. Models are aggregated from **all configured providers**, displayed as `"Provider Name / Model Name"`. Commentary model is required. Prayer model defaults to "Same as Commentary".

## Current State

- Models are fetched per-provider and cached per-endpoint in `localStorage["bibleCompanion_models"]`
- Provider configs store `primaryModel` and optional `supportModel` (with toggle/radio for separate endpoint)
- `sendToAI()` uses `getActiveProvider()` for commentary
- `enhancePrayerWithAI()` uses `getSupportConfig()` for prayer
- Models pane has: Commentary Model section (select/input + fetch), Prayer Model section (toggle, radio, select/input, separate endpoint/key fields)

## Changes

### 1. Data Model (`js/settings.js`)

#### New settings-level fields

```js
const DEFAULT_SETTINGS = {
  providers: [/* unchanged */],
  activeProviderId: "default",
  prayerSignature: "\u2014 Bible Companion",
  commentaryModel: null,   // "providerId::modelId" or null
  prayerModel: null        // "providerId::modelId" or null (null = same as commentary)
};
```

- `commentaryModel` and `prayerModel` stored as encoded strings: `"providerId::modelId"`
- `prayerModel: null` means "use same as commentary model"
- Remove `primaryModel` and `supportModel` from provider objects (migrate existing values)

#### Migration logic in `migrateOldSettings()`

- If provider has `primaryModel`, save it as `commentaryModel: "providerId::primaryModel"`
- If provider has `supportModel` with a different model, save as `prayerModel: "providerId::supportModel.model"`
- Otherwise `prayerModel` stays `null`

#### New exported functions

```js
export function getCommentaryModel() {
  // Returns { providerId, modelId, provider } or null
  if (!settings.commentaryModel) return null;
  const [providerId, modelId] = settings.commentaryModel.split("::");
  const provider = getProviderById(providerId);
  return provider ? { providerId, modelId, provider } : null;
}

export function getPrayerModel() {
  // Returns { providerId, modelId, provider } or falls back to commentary
  if (settings.prayerModel) {
    const [providerId, modelId] = settings.prayerModel.split("::");
    const provider = getProviderById(providerId);
    if (provider) return { providerId, modelId, provider };
  }
  return getCommentaryModel();  // fallback
}

export function setCommentaryModel(value) {
  // value is "providerId::modelId" or null
  settings.commentaryModel = value;
  saveSettingsLocally();
}

export function setPrayerModel(value) {
  // value is "providerId::modelId" or null (null = same as commentary)
  settings.prayerModel = value;
  saveSettingsLocally();
}
```

#### Aggregated model list builder

```js
export function buildAggregatedModelList() {
  // Returns array of { providerId, providerName, modelId, displayName }
  // displayName = "Provider Name / Model Name"
  const modelsStore = loadCachedModels();
  const result = [];
  for (const provider of settings.providers) {
    const cached = modelsStore && typeof modelsStore === "object"
      ? modelsStore[provider.endpoint]
      : null;
    const models = cached || [];
    for (const modelId of models) {
      result.push({
        providerId: provider.id,
        providerName: provider.name,
        modelId,
        displayName: `${provider.name} / ${modelId}`
      });
    }
  }
  return result;
}
```

#### Removed functions/logic

- Remove `getSupportConfig()` (replaced by `getPrayerModel()`)
- Remove `populateSupportModelSelect`, `switchSupportToSelectMode`, `switchSupportToInputMode`
- Remove `saveSupportModelFromUI`
- Remove support model toggle/radio event handlers
- Remove `supportModel` handling in `addProvider`, `updateProvider`

### 2. HTML (`index.html`) — Models pane

Replace the Models pane content (lines 204-287) with:

```html
<section data-settings-pane="models" class="settings-pane">
  <div class="settings-context-card" id="settings-context-card">
    <div class="settings-context-name" id="settings-context-name"></div>
    <div class="settings-context-endpoint" id="settings-context-endpoint"></div>
  </div>

  <div class="settings-section-header primary-section">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
    <span>Commentary Model</span>
  </div>

  <div class="form-group">
    <label for="commentary-model-select">Model</label>
    <select id="commentary-model-select" required>
      <option value="">-- Select a model --</option>
    </select>
    <small class="form-hint">Required. Model used for Bible commentary generation.</small>
  </div>

  <div class="settings-section-header support-section">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 4-6.4 3.2 0-.5 3.4 3 3.4"/><path d="M12 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>
    <span>Prayer Model</span>
  </div>

  <div class="form-group">
    <label for="prayer-model-select">Model</label>
    <select id="prayer-model-select">
      <option value="">Same as Commentary Model</option>
    </select>
    <small class="form-hint">Optional. Defaults to the Commentary Model if not changed.</small>
  </div>

  <div class="model-refresh-row">
    <button type="button" id="refresh-all-models-btn" class="btn-secondary" title="Fetch models from all providers">
      Refresh All Models
    </button>
  </div>

  <div id="connection-status" class="status-message"></div>
</section>
```

Removed elements: `model-select`, `model-name`, `fetch-models-btn`, `support-model-toggle`, `support-model-section`, `support-same-hint`, `support-same-endpoint-radio`, `support-separate-endpoint-radio`, `support-model-select`, `support-model-name`, `support-fetch-models-btn`, `support-endpoint-group`, `support-api-key-group`, `support-endpoint-url`, `support-api-key`.

### 3. Settings JS — Modal logic (`js/settings.js`)

#### Populate dropdowns

```js
function populateModelDropdowns() {
  const aggregated = buildAggregatedModelList();
  const commentarySelect = document.getElementById("commentary-model-select");
  const prayerSelect = document.getElementById("prayer-model-select");

  // Commentary dropdown
  commentarySelect.innerHTML = '<option value="">-- Select a model --</option>';
  for (const m of aggregated) {
    const opt = document.createElement("option");
    opt.value = m.providerId + "::" + m.modelId;
    opt.textContent = m.displayName;
    commentarySelect.appendChild(opt);
  }
  commentarySelect.value = settings.commentaryModel || "";

  // Prayer dropdown
  prayerSelect.innerHTML = '<option value="">Same as Commentary Model</option>';
  for (const m of aggregated) {
    const opt = document.createElement("option");
    opt.value = m.providerId + "::" + m.modelId;
    opt.textContent = m.displayName;
    prayerSelect.appendChild(opt);
  }
  prayerSelect.value = settings.prayerModel || "";
}
```

#### Dropdown change handlers

```js
commentarySelect.addEventListener("change", () => {
  setCommentaryModel(commentarySelect.value || null);
});

prayerSelect.addEventListener("change", () => {
  setPrayerModel(prayerSelect.value || null);
});
```

#### Refresh All Models button

Fetch models from every configured provider in parallel, update cache, re-populate dropdowns.

```js
document.getElementById("refresh-all-models-btn").addEventListener("click", async () => {
  setStatus("Fetching models from all providers...", "");
  let totalModels = 0;
  let failures = 0;

  for (const provider of settings.providers) {
    const modelsUrl = deriveModelsUrl(provider.endpoint);
    const models = await fetchModels(modelsUrl, provider.apiKey);
    if (models && models.length > 0) {
      cacheModels(provider.endpoint, models);
      totalModels += models.length;
    } else {
      failures++;
    }
  }

  populateModelDropdowns();

  if (failures === settings.providers.length) {
    setStatus("Could not fetch models from any provider.", "error");
  } else {
    setStatus(`Found ${totalModels} models across ${settings.providers.length - failures} provider(s).`, "success");
  }
});
```

#### Form submit — simplified

Save commentary/prayer model from dropdowns. Remove all support model logic.

#### On modal open

Call `populateModelDropdowns()` instead of `populateProviderForm()` for the models pane.

### 4. App JS (`js/app.js`)

#### Import update

```js
import { loadSettingsLocally, getActiveProvider, getCommentaryModel, getPrayerModel, getPrayerSignature } from "./settings.js";
```

#### `sendToAI()` — use commentary model

```js
const commentaryConfig = getCommentaryModel();
if (!commentaryConfig) {
  // error: no commentary model configured
  return;
}
// Use commentaryConfig.provider.endpoint, commentaryConfig.provider.apiKey, commentaryConfig.modelId
```

#### `enhancePrayerWithAI()` — use prayer model

Replace `getSupportConfig()` with `getPrayerModel()`:

```js
const prayerConfig = getPrayerModel();
if (!prayerConfig) {
  showPrayerStatus("No model configured");
  return;
}
// Use prayerConfig.provider.endpoint, prayerConfig.provider.apiKey, prayerConfig.modelId
```

#### `updateProviderStatus()` — show both models

Resolve both models and display in the header status bar using the display name format.

### 5. CSS (`css/app.css`)

- Remove: `.support-toggle-row`, `.endpoint-radio-group`, `.support-field-conditional`, support-related modern theme overrides
- Add: `.model-refresh-row` styling for the refresh button
- Keep: `.settings-section-header`, `.model-selector-row` (still used by other elements if needed)

### 6. Providers pane — unchanged

The Providers pane remains as-is for managing provider names, endpoints, and API keys. The Models pane no longer has per-provider model inputs.

## Implementation Order

1. **`js/settings.js`** — New data model, migration, `getCommentaryModel()`, `getPrayerModel()`, `buildAggregatedModelList()`, dropdown logic, remove old support model logic
2. **`index.html`** — Simplified Models pane with two dropdowns + refresh button
3. **`css/app.css`** — Clean up removed styles, add refresh button row
4. **`js/app.js`** — Import new functions, update `sendToAI()`, `enhancePrayerWithAI()`, `updateProviderStatus()`

## Backward Compatibility

- Migration in `migrateOldSettings()` converts `primaryModel` → `commentaryModel`, `supportModel` → `prayerModel`
- `getPrayerModel()` falls back to `getCommentaryModel()` when `prayerModel` is null
- Existing cached models in localStorage are reused (same cache key/format)
- Provider objects no longer need `primaryModel`/`supportModel` after migration

## Edge Cases

| Case | Handling |
|------|----------|
| No models fetched yet | Dropdowns show placeholder, user clicks "Refresh All Models" |
| Commentary model set, prayer left default | `prayerModel` is null, `getPrayerModel()` returns commentary config |
| Provider deleted while its model is selected | Dropdown repopulated, selection clears, user picks new model |
| All providers fail to fetch | Error status, user can retry or add working provider |
| Settings reset | Both `commentaryModel` and `prayerModel` reset to null |
