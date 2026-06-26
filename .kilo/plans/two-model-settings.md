# Two-Model Settings: Primary + Support

## Overview

Split the single AI model configuration into two roles:
- **Primary Model** — used for Bible commentary generation (`sendToAI`)
- **Support Model** — used for prayer request formatting (`enhancePrayerWithAI`)

The support model can either share the primary provider's endpoint/API key or use a completely separate endpoint.

---

## 1. Data Model Changes (`js/settings.js`)

### New Provider Schema

```js
{
  id: "default",
  name: "Default Provider",
  endpoint: "https://...",
  apiKey: "sk-...",
  primaryModel: "gpt-4o",
  supportModel: null  // null = use primaryModel, or { model, endpoint, apiKey } for separate
}
```

### New Default Settings

```js
const DEFAULT_SETTINGS = {
  providers: [
    {
      id: "default",
      name: "Default Provider",
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: "",
      primaryModel: "gpt-4o",
      supportModel: null
    }
  ],
  activeProviderId: "default",
  prayerSignature: "\u2014 Bible Companion"
};
```

### New/Updated Functions

| Function | Purpose |
|----------|---------|
| `getActiveProvider()` | Unchanged — returns provider for commentary |
| `getSupportConfig()` | NEW — returns `{ model, endpoint, apiKey }` for prayer. If `supportModel` is null, falls back to primary provider's config |
| `migrateOldSettings()` | Updated — renames `model` → `primaryModel`, adds `supportModel: null` |
| `addProvider()` | Updated — includes `primaryModel` and `supportModel: null` |
| `updateProvider()` | Updated — handles `primaryModel` and nested `supportModel` object |

### Migration Logic

In `migrateOldSettings`, for each provider:
- `model` → `primaryModel`
- `supportModel` → `null` (default)

Also add a runtime guard: if a provider is missing `primaryModel` (e.g., loaded from old localStorage), fall back to `provider.model`.

---

## 2. HTML Changes (`index.html`)

Restructure the settings form into two visually distinct sections with section header cards.

### Form Structure

```
Settings Modal
├── Theme (dropdown)
├── Prayer Signature (input)
│
├── ══════════════════════════════════
│   PRIMARY MODEL (for Bible Commentary)  [navy header card]
│   ══════════════════════════════════
│   ├── Provider (dropdown)
│   ├── Provider Name (input)
│   ├── Endpoint URL (input)
│   ├── API Key (password input)
│   └── Model (select/input + fetch button)
│
├── ══════════════════════════════════
│   SUPPORT MODEL (for Prayer Formatting) [gold header card]
│   ══════════════════════════════════
│   ├── Toggle: "Use same as Primary" / "Use different model"
│   ├── [When "same"] hint text: "Prayer formatting will use the Primary model"
│   ├── [When "different"]
│   │   ├── Radio: "Same provider endpoint" / "Separate endpoint"
│   │   ├── Model (select/input + fetch button)
│   │   ├── [When "separate"]
│   │   │   ├── Endpoint URL (input)
│   │   │   └── API Key (password input)
│   │   └── [When "same provider"]
│   │       └── Model only (inherits endpoint + API key from primary)
│   └── small hint: "Support model is used for AI prayer request formatting"
│
├── Connection Status
├── Add Provider / Delete Provider
└── Reset Defaults / Save Settings
```

### New HTML Elements

| ID | Type | Purpose |
|----|------|---------|
| `support-model-toggle` | checkbox | Toggle between "same as primary" and "different model" |
| `support-model-section` | div | Container for support model config (shown/hidden by toggle) |
| `support-same-endpoint-radio` | radio | Use primary's endpoint + API key |
| `support-separate-endpoint-radio` | radio | Use separate endpoint + API key |
| `support-endpoint-url` | url input | Separate endpoint URL (conditional) |
| `support-api-key` | password input | Separate API key (conditional) |
| `support-model-select` | select | Model dropdown (hidden initially) |
| `support-model-name` | text input | Manual model name (hidden initially) |
| `support-fetch-models-btn` | button | Fetch models for support endpoint |

### Section Header Cards

Add `<div class="settings-section-header primary-section">` and `<div class="settings-section-header support-section">` as visual dividers with icons and descriptive labels.

---

## 3. CSS Changes (`css/app.css`)

### New Styles

```css
/* Section header cards */
.settings-section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin: 1rem 0 0.75rem;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 4px;
}

.settings-section-header.primary-section {
  background: var(--navy);
  color: var(--gold-light);
}

.settings-section-header.support-section {
  background: var(--gold);
  color: #fff;
}

.settings-section-header svg {
  flex-shrink: 0;
}

/* Support model toggle */
.support-toggle-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.support-toggle-row input[type="checkbox"] {
  /* styled checkbox */
}

.support-toggle-row label {
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
}

/* Radio group for endpoint choice */
.endpoint-radio-group {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.endpoint-radio-group label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  cursor: pointer;
}

/* Conditional fields */
.support-field-conditional {
  display: none;
}

.support-field-conditional.visible {
  display: block;
}

/* Modern theme overrides */
[data-theme="modern"] .settings-section-header {
  border-radius: 8px;
}
```

---

## 4. Settings JS Logic (`js/settings.js`)

### populateFormFromProvider — Extended

When populating the form from a provider:
1. Set primary model fields (existing logic, using `primaryModel`)
2. Check `provider.supportModel`:
   - If `null` → toggle OFF (use same as primary)
   - If object → toggle ON, populate support model fields
   - Check if `supportModel.endpoint` exists → set radio accordingly

### New Event Handlers

1. **Support toggle change**: Show/hide `support-model-section`
2. **Endpoint radio change**: Show/hide separate endpoint fields vs model-only
3. **Support fetch models**: Fetch from support endpoint (or primary endpoint if "same provider" selected)
4. **Form submit**: Save support model config as nested object or null

### saveModelFromUI — Extended

Save both primary and support model state:
```js
function saveProviderFromUI() {
  const provider = getSelectedProvider();
  if (!provider) return;

  // Primary model
  provider.primaryModel = getPrimaryModelFromUI();

  // Support model
  if (supportToggle.checked) {
    if (sameEndpointRadio.checked) {
      provider.supportModel = { model: getSupportModelFromUI() };
    } else {
      provider.supportModel = {
        model: getSupportModelFromUI(),
        endpoint: supportEndpointInput.value.trim(),
        apiKey: supportApiKeyInput.value.trim()
      };
    }
  } else {
    provider.supportModel = null;
  }
}
```

### getSupportConfig — New Function

```js
export function getSupportConfig() {
  const provider = getActiveProvider();
  if (!provider) return null;

  const sm = provider.supportModel;
  if (!sm) {
    // Fall back to primary
    return {
      model: provider.primaryModel || provider.model,
      endpoint: provider.endpoint,
      apiKey: provider.apiKey,
      name: provider.name
    };
  }

  return {
    model: sm.model,
    endpoint: sm.endpoint || provider.endpoint,
    apiKey: sm.apiKey !== undefined ? sm.apiKey : provider.apiKey,
    name: sm.endpoint ? "Separate" : provider.name
  };
}
```

---

## 5. App JS Changes (`js/app.js`)

### Import Update

```js
import { loadSettingsLocally, getActiveProvider, getSupportConfig, getPrayerSignature } from "./settings.js";
```

### enhancePrayerWithAI — Modified

Replace `const provider = getActiveProvider()` with `const supportConfig = getSupportConfig()` and use `supportConfig.model`, `supportConfig.endpoint`, `supportConfig.apiKey` throughout the function.

Specifically:
- `requestBody.model` → `supportConfig.model`
- `fetch(provider.endpoint, ...)` → `fetch(supportConfig.endpoint, ...)`
- `provider.apiKey` → `supportConfig.apiKey`
- Console logs → reference `supportConfig` instead of `provider`

### updateProviderStatus — Enhanced

Show both models in the header status:
```js
function updateProviderStatus() {
  const provider = getActiveProvider();
  const support = getSupportConfig();
  const el = document.getElementById("provider-status");
  if (!el || !provider) return;

  const primaryModel = provider.primaryModel || provider.model;
  const supportModel = support ? support.model : primaryModel;
  const sameModel = primaryModel === supportModel;

  if (sameModel) {
    el.innerHTML = `<span class="provider-status-dot"></span><span>${provider.name} / ${primaryModel}</span>`;
    el.title = `Primary: ${primaryModel}\nSupport: ${supportModel} (same)`;
  } else {
    el.innerHTML = `<span class="provider-status-dot"></span><span>${provider.name} / ${primaryModel} | ${supportModel}</span>`;
    el.title = `Primary (Commentary): ${primaryModel}\nSupport (Prayer): ${supportModel}`;
  }
}
```

---

## 6. Implementation Order

1. **`js/settings.js`** — Data model, migration, `getSupportConfig()`, form logic
2. **`index.html`** — Restructured settings modal with new sections
3. **`css/app.css`** — Section headers, toggle, radio groups, conditional fields
4. **`js/app.js`** — Import `getSupportConfig`, update `enhancePrayerWithAI`, update status display

---

## 7. Backward Compatibility

- Old `provider.model` → migrated to `provider.primaryModel`
- `provider.supportModel` defaults to `null` (use primary)
- Runtime guard: `provider.primaryModel || provider.model`
- `getSupportConfig()` falls back to primary provider when `supportModel` is `null`
- Existing users see no behavioral change until they opt into the support model

---

## 8. Edge Cases

| Case | Handling |
|------|----------|
| Support model toggle OFF | `supportModel = null`, prayer uses primary |
| Support model ON, same endpoint | `supportModel = { model: "..." }`, inherits endpoint + key from primary |
| Support model ON, separate endpoint | Full `supportModel` object with its own endpoint + key |
| Primary provider deleted | Active provider switches, support follows active provider |
| Fetch models fails for support | Falls back to manual text input (same behavior as primary) |
| Empty support model name | Validation prevents save with empty model |
