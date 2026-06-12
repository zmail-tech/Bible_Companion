# Multi-Provider Configuration

## Goal

Allow users to configure multiple AI endpoints as named providers with custom identifiers, each with its own endpoint URL, API key, and model. A dropdown in the settings modal selects the active provider.

## Design

### Data Model

Replace the flat settings object with a provider-based schema:

```javascript
// Current (flat)
{
  endpoint: "https://api.openai.com/v1/chat/completions",
  apiKey: "",
  model: "gpt-4o"
}

// New (provider-based)
{
  providers: [
    {
      id: "openai",           // unique identifier (custom, user-defined)
      name: "OpenAI",         // display name
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: "",
      model: "gpt-4o"
    }
  ],
  activeProviderId: "openai"  // which provider is currently selected
}
```

Each provider has:
- `id`: unique string identifier (user-defined, like "openai", "ollama-local", "litellm-work")
- `name`: human-readable display name
- `endpoint`: the API endpoint URL
- `apiKey`: the API key (optional)
- `model`: the model name

### Backward Compatibility

On first load after the change, detect the old flat settings format and migrate it to a single provider automatically:

```javascript
function migrateOldSettings(oldSettings) {
  if (!oldSettings || !oldSettings.endpoint) return null;
  return {
    providers: [{
      id: "default",
      name: "Default Provider",
      endpoint: oldSettings.endpoint,
      apiKey: oldSettings.apiKey || "",
      model: oldSettings.model || "gpt-4o"
    }],
    activeProviderId: "default"
  };
}
```

### Settings Modal UI Changes

Replace the single endpoint/model/key fields with:

1. **Provider selector dropdown** at the top (new element `id="provider-select"`)
2. **Provider name field** (new element `id="provider-name"`) — only shown when editing an existing provider or adding a new one
3. **Existing fields** (endpoint URL, API key, model) — now apply to the selected provider
4. **Add Provider** button (new element `id="add-provider-btn"`)
5. **Delete Provider** button (new element `id="delete-provider-btn"`) — disabled if only one provider exists
6. Keep the **Fetch Models** and **Save Settings** buttons

The workflow:
1. Open settings → dropdown shows all providers, currently active one is selected
2. Select a provider → its config fields populate the form
3. Edit fields → click "Save Settings" saves that provider's config
4. Click "Add Provider" → creates a new empty provider, selects it in the dropdown
5. Click "Delete Provider" → removes the selected provider (can't delete the last one)

### Code Changes

#### `js/settings.js`

1. **Update `STORAGE_KEY`** — keep the same key, but the stored structure changes
2. **Update `DEFAULT_SETTINGS`** — change to provider-based default with one provider
3. **Add `providers` and `activeProviderId`** to the settings object
4. **Add `migrateOldSettings()`** — detect and migrate old flat format
5. **Add `getActiveProvider()`** — returns the currently active provider object
6. **Add `addProvider()`, `deleteProvider()`, `setActiveProvider(id)`** functions
7. **Add `getProviderById(id)`, `updateProvider(id, data)`** functions
8. **Update `loadSettingsLocally()`** — call `migrateOldSettings()` on old-format data
9. **Update `initSettingsModal()`** — refactor to handle multi-provider UI:
   - Populate provider dropdown from `settings.providers`
   - On provider select change, populate form fields with that provider's data
   - Wire up "Add Provider" and "Delete Provider" buttons
   - On form submit, save the selected provider's data instead of flat settings
10. **Update model caching** — change `MODELS_STORAGE_KEY` to support per-endpoint caching (store as object keyed by endpoint URL, e.g., `{ "https://api.openai.com/v1/models": [...], "http://localhost:11434/v1/models": [...] }`)

#### `js/app.js`

1. **Update `sendToAI()`** — use `getActiveProvider()` instead of `getSettings()` to get endpoint/apiKey/model
2. No other changes needed — the request format remains the same

#### `index.html`

1. Add provider selector dropdown before the endpoint URL field
2. Add provider name input field
3. Add "Add Provider" and "Delete Provider" buttons in the form actions area
4. Update form labels/hints as needed

#### `css/app.css`

1. Add styles for the provider selector, add/delete buttons
2. Style the provider name field
3. Ensure the form layout handles the new elements gracefully

## Implementation Order

1. **Update `settings.js`** — new data model, migration, provider CRUD functions
2. **Update `index.html`** — new UI elements for provider management
3. **Update `css/app.css`** — styles for new elements
4. **Update `app.js`** — use `getActiveProvider()` in `sendToAI()`
5. **Test** — verify migration works, provider switching works, saving/deleting works
