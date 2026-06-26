# Settings Left-Tab Overhaul

## Goal

Redesign the settings modal so the workflow is easier to follow:

1. **General** — theme and prayer signature.
2. **Providers** — add and manage any number of AI providers.
3. **Models** — configure:
   - Commentary Model
   - Prayer Model, defaulting to the Commentary Model when no separate Prayer Model is defined.

## Current State

- `index.html` currently has one long vertical settings form with mixed General, Provider, and Model fields.
- `js/settings.js` already stores provider data as `settings.providers`, `activeProviderId`, and `provider.primaryModel`, but the UI still exposes provider/model details together.
- `js/app.js` already uses `getSupportConfig()` for prayer formatting, so the data model can be reused.

## Proposed UI Structure

Replace the current modal body with:

```html
<div class="settings-modal-shell">
  <nav class="settings-sidebar" aria-label="Settings">
    <button class="settings-nav-item active" data-settings-pane="general">General</button>
    <button class="settings-nav-item" data-settings-pane="providers">Providers</button>
    <button class="settings-nav-item" data-settings-pane="models">Models</button>
  </nav>

  <div class="settings-panes">
    <section data-settings-pane="general" class="settings-pane active">
      Theme
      Prayer Signature
    </section>

    <section data-settings-pane="providers" class="settings-pane">
      Provider list
      Add Provider
      Delete Provider
    </section>

    <section data-settings-pane="models" class="settings-pane">
      Active provider context
      Commentary Model
      Prayer Model
    </section>
  </div>
</div>
```

### General Tab

- Theme selector.
- Prayer signature input.
- Short hint explaining the signature is used when copying prayer text.

### Providers Tab

- Left or card-style provider list.
- Add Provider button.
- Delete Provider button disabled when only one provider remains.
- Editing a provider should update the Models tab context automatically.

### Models Tab

- Show the selected provider at the top:
  - Provider name
  - Endpoint
  - Active status or connection status
- **Commentary Model**
  - Same model discovery/manual-entry behavior as current UI.
  - This is the model used for Bible commentary.
- **Prayer Model**
  - If blank, prayer formatting uses the Commentary Model.
  - If filled in, prayer formatting uses the separate Prayer Model.
  - Optional compact control for a separate prayer endpoint/API key can remain if needed, but it should be visually secondary to the model choice.

## Data Model

Keep the existing provider schema:

```js
{
  providers: [
    {
      id,
      name,
      endpoint,
      apiKey,
      primaryModel,
      supportModel: null
    }
  ],
  activeProviderId,
  prayerSignature
}
```

For the new UI:

- `primaryModel` remains the Commentary Model.
- `provider.supportModel.model` remains the Prayer Model.
- `provider.supportModel` should be `null` when the Prayer Model is not separately defined.
- If the Prayer Model input is empty on save, clear `provider.supportModel`.

## JavaScript Changes

### `js/settings.js`

- Refactor `initSettingsModal()` into clearly separated helpers:
  - `renderSettingsSidebar()`
  - `switchSettingsPane(paneName)`
  - `populateProviderList()`
  - `populateProviderForm(provider)`
  - `saveProviderFromUI()`
  - `getPrayerModelFromUI(provider)`
- Add or update helpers for active provider context in the Models tab.
- Keep existing model discovery/cache behavior, but move the UI state into the new tab workflow.
- Keep `getSupportConfig()` behavior unchanged so `js/app.js` does not need behavior changes.

### `js/app.js`

- No major behavior change required.
- Keep using `getSupportConfig()` for prayer formatting.
- Optionally improve provider status tooltip to mention:
  - Primary = commentary
  - Support/prayer = commentary model when shared

### `index.html`

- Replace the long form body with the new modal shell and panes.
- Keep existing buttons/ids where possible, or introduce cleaner ids:
  - `settings-nav-General`
  - `settings-nav-Providers`
  - `settings-nav-Models`
  - `settings-pane-General`
  - `settings-pane-Providers`
  - `settings-pane-Models`

### `css/app.css`

Add robust modal styles:

- `.settings-modal-shell`
- `.settings-sidebar`
- `.settings-nav-item`
- `.settings-nav-item.active`
- `.settings-panes`
- `.settings-pane`
- `.settings-provider-card`
- `.settings-provider-list`
- `.settings-context-card`
- `.model-card`
- `.model-card.active`
- `.prayer-model-default-hint`

Design direction:

- Sidebar on the left with active-state styling.
- Panes on the right with cards and compact form groups.
- Modern theme should get rounded cards, subtle borders, and cleaner spacing.
- Keep the current theme variables (`--navy`, `--burgundy`, `--gold`, etc.) so the redesign feels native to the app.

## Migration / Backward Compatibility

- Existing settings with `supportModel: null` continue to work.
- Existing settings with `provider.model` continue to migrate to `provider.primaryModel`.
- Existing settings with `provider.supportModel` continue to work as separate Prayer Model config.
- Empty Prayer Model saves as `null`, meaning prayer formatting defaults to the Commentary Model.

## Verification

After implementation, verify:

1. Opening Settings shows three left tabs.
2. General tab contains only Theme and Prayer Signature.
3. Providers tab lets users add/delete providers and cannot delete the last provider.
4. Models tab shows active provider context.
5. Prayer Model blank defaults to the Commentary Model.
6. Prayer Model filled in uses the separate model for prayer formatting.
7. Existing provider/model/config behavior remains compatible.
