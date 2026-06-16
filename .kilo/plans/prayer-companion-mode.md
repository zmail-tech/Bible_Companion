# Prayer Companion Mode Plan

## Goal
Add a lightweight `Prayer Companion` mode for planning prayer lists using a markdown-enabled textarea, local saving, bottom signature, and clipboard copy.

## Current app context
- `index.html` contains a header, tab bar, split Bible reader, AI panel, and settings modal.
- `js/app.js` owns app bootstrapping, tab switching, markdown rendering, localStorage persistence, and service worker registration.
- `css/app.css` defines the existing split layout, AI panel, markdown rendering styles, buttons, and responsive behavior.
- The app has no build step and uses browser `localStorage`; no new dependency is needed.

## Proposed implementation
1. **Mode selection**
   - Add a `Prayer Companion` mode item in the existing tab bar or a small mode switch next to tabs.
   - Treat it as a first-class mode while preserving existing Bible/AI tabs.
   - When selected, hide Bible navigation and Bible reader content, switch the split container to a single prayer layout, and render the prayer editor.

2. **Prayer editor**
   - Add a textarea for prayer-list content with markdown input support.
   - Use `white-space: pre-wrap` for the editor display and the existing `renderMarkdown()` helper for a live/read-only preview.
   - Provide a simple toolbar or hint showing supported markdown: headings, bold, italic, bullets, code, and code blocks.

3. **Save behavior**
   - Save prayer text to `localStorage` using a dedicated key such as `bibleCompanion_prayerCompanion`.
   - Restore the saved prayer text on reload.
   - Show a small `Saved` status after save.
   - Keep the Prayer mode isolated from Bible tab persistence.

4. **Signature and copy**
   - Render a bottom signature area when Prayer mode is active.
   - Default signature: `— Bible Companion`.
   - Copy button uses `navigator.clipboard.writeText()` and falls back to a temporary textarea + `document.execCommand("copy")` if clipboard APIs are unavailable.
   - Show `Copied` status briefly after a successful copy.

5. **Layout**
   - Add Prayer-specific CSS for the editor, preview, signature, and buttons.
   - Add responsive behavior so the prayer editor occupies most of the viewport on mobile.
   - Ensure the existing split splitter and Bible reader do not break Prayer mode.

6. **Markdown support**
   - Reuse existing `renderMarkdown()` and `escapeHtml()` helpers.
   - Keep markdown support simple and client-side only, matching the current AI response renderer.

## Files to change
- `index.html`: add Prayer mode markup and any Prayer-specific controls.
- `js/app.js`: add Prayer mode state, editor rendering, save/restore, signature, and copy behavior.
- `css/app.css`: add Prayer mode layout and styling.

## Validation
- Open the app locally and verify switching to Prayer Companion.
- Type markdown, verify preview rendering.
- Refresh the page and verify saved prayer text returns.
- Test copy button with clipboard and fallback behavior.
- Test responsive behavior below `768px`.
