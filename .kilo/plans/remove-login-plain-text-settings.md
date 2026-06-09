# Simplify App: Remove Login, Store Settings in Plain Text

## Goal
Remove all login/authentication logic. Store connection settings in plain text using localStorage. No user accounts, no encryption, no SQLite for settings.

## Files to Delete
- `js/auth.js` — authentication/session management (no longer needed)
- `js/login.js` — login/register UI controller (no longer needed)
- `js/crypto.js` — encryption utilities (no longer needed)
- `js/sqlite.js` — SQLite database layer (no longer needed; only used for user accounts and encrypted settings)
- `vendor/sql-wasm.js` — sql.js WASM module (no longer needed)
- `vendor/sql-wasm.wasm` — sql.js WASM binary (no longer needed)

## Files to Modify

### 1. `index.html`
- **Remove** the logout button (`#logout-btn`) from the header (lines 17-23)
- **Remove** the entire login modal (`#login-modal`, lines 104-143)
- **Remove** script import for `js/login.js` (line 147 — keep settings.js, bible.js, app.js)
- **Keep** API key input type as `password` (line 87) — UI masks the key for display privacy, but stored in plain text in localStorage

### 2. `js/app.js`
- **Remove imports:** `isAuthenticated`, `getCurrentUser`, `getCurrentSettings` from `auth.js`; `initLoginForm`, `showLoginScreen`, `hideLoginScreen` from `login.js`; `initDB` from `sqlite.js`
- **Simplify `bootstrap()`:**
  - Remove `initDB()` call
  - Remove `initLoginForm()` call
  - Remove `isAuthenticated()` check and login flow
  - Load settings from localStorage (plain text) and call `window.loadSettings()`
  - Call `hideLoginScreen()` is not needed; instead just call `startApp()` directly
- **Remove** the `user-login` event listener (no longer dispatched)
- **Remove** the `usersExist()` diagnostic localStorage check

### 3. `js/settings.js`
- **Remove imports:** `saveUserSettings` from `sqlite.js`; `getPassword` from `auth.js`
- **Add** a plain-text localStorage key for settings, e.g. `bibleCompanion_settings`
- **Add** `saveSettingsLocally()` function that writes `{endpoint, apiKey, model}` as JSON to localStorage
- **Add** `loadSettingsLocally()` function that reads from localStorage and returns parsed JSON or defaults
- **Update** `initSettingsModal`:
  - On form submit: call `saveSettingsLocally()` instead of `saveUserSettings(user.id, settings, password)`
  - On reset: call `saveSettingsLocally()` with defaults instead of sqlite path
  - Remove all references to `getPassword()`, `user`, and `saveUserSettings`
- **Update** the `openModal()` function: show the API key as plain text in the input (or keep password input for UI, but store in plain text)

### 4. `sw.js` (Service Worker)
- **Bump cache version** from `v3` to `v4` to force re-cache after removing deleted files
- **Remove** deleted files from `STATIC_ASSETS`: `js/crypto.js`, `js/sqlite.js`, `js/auth.js`, `js/login.js`, `vendor/sql-wasm.js`, `vendor/sql-wasm.wasm`

### 5. `README.md`
- **Update** description: remove references to multi-user auth, encrypted settings, login gate, SQLite
- **Update** features list: remove multi-user authentication, encrypted settings, login gate; add "Plain-text settings stored in localStorage"
- **Update** architecture section: remove auth.js, sqlite.js, crypto.js, login.js, vendor/sql-wasm.js from tree
- **Replace** Security & Storage section with simplified Storage section noting settings are stored in plain text in localStorage (suitable for local-only use)
- **Update** First Run: remove registration step; start directly with settings

### 6. `css/app.css`
- No changes needed — no login-specific styles exist. Modal styles are shared between settings and (removed) login.

## New Settings Storage Format
Settings stored as plain JSON in localStorage under key `bibleCompanion_settings`:
```json
{
  "endpoint": "https://api.openai.com/v1/chat/completions",
  "apiKey": "sk-...",
  "model": "gpt-4o"
}
```

## Data Flow After Changes

```
App starts (app.js bootstrap)
  -> loadSettingsLocally() reads localStorage
  -> window.loadSettings(settings)
  -> startApp()

User opens settings modal
  -> Current settings loaded into form
  -> User edits and saves
  -> saveSettingsLocally() writes JSON to localStorage
  -> In-memory settings updated
  -> Connection test runs

User clicks "Send to AI"
  -> getSettings() returns in-memory settings
  -> API call uses endpoint, apiKey, model
```

## Migration Consideration
Existing users with encrypted data in SQLite/IndexedDB will lose their settings. This is acceptable since the user indicated this is a local-only app and wants to simplify. No migration path needed.
