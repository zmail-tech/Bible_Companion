# Plan: Markdown Support and Prayer Signature Settings

## Goal
Improve the app's Markdown rendering in the AI response and prayer preview, and add a configurable prayer signature used both in the preview footer and copied prayer text.

## Key findings
- `js/app.js` contains a custom Markdown renderer at `js/app.js:900` that escapes text first, then applies inline regexes. This works for simple headings, bold, italic, lists, and code, but fails for Markdown horizontal rules like `* * *`, which are parsed as italic text instead of a line break/separator.
- Prayer preview rendering is also handled by `renderMarkdown()` in `js/app.js:1005`.
- Clipboard copying appends the hard-coded `PRAYER_SIGNATURE = "— Bible Companion"` in `js/app.js:37` and `js/app.js:1029`.
- `js/settings.js` owns settings localStorage, default settings, and the settings modal.
- `index.html` contains the settings modal and prayer footer signature element.

## Implementation plan
1. Replace the current regex-based renderer with a safer line-oriented Markdown renderer.
   - Normalize line endings.
   - Preserve inline code and fenced code blocks.
   - Render Markdown headings (`#`, `##`, `###`) as `<h1>`, `<h2>`, `<h3>`.
   - Render unordered lists, including `*`, `-`, and `+`.
   - Render ordered lists.
   - Render paragraphs separated by blank lines.
   - Render horizontal rules (`---`, `***`, `* * *`, `_ _ _`) as semantic `<hr class="markdown-hr">` elements instead of inline italic text.
   - Keep all rendered content escaped/sanitized before inserting via `innerHTML`.
   - Avoid parsing inline Markdown inside code blocks.

2. Add styling for rendered Markdown and horizontal rules.
   - Add CSS for `.markdown-hr` in AI response and prayer preview contexts.
   - Ensure horizontal rules appear as clean separators/line breaks in both previews.

3. Make the prayer signature configurable in settings.
   - Add `prayerSignature` to `DEFAULT_SETTINGS` in `js/settings.js`, defaulting to `— Bible Companion`.
   - Add exported helpers such as `getPrayerSignature()` and `setPrayerSignature()` or equivalent settings accessors.
   - Add a settings form field for the prayer signature, likely near the theme/provider settings.
   - Ensure reset defaults restores `— Bible Companion`.
   - Ensure saved settings include the signature.

4. Wire the signature into prayer UI and clipboard behavior.
   - Import the settings accessor into `js/app.js`.
   - Use the configured signature in `copyPrayerToClipboard()` instead of the hard-coded constant.
   - Update `#prayer-signature` when prayer mode initializes and when the settings modal saves a new signature.
   - Preserve the current default behavior for existing users by migrating missing settings to the default.

5. Validate behavior.
   - Manually verify `* * *` renders as a separator/line break in both AI response and prayer preview.
   - Verify headings, bold, italic, inline code, fenced code, bullets, and numbered lists still render correctly.
   - Verify the settings modal can edit the signature and persists it.
   - Verify copying prayer text appends the configured signature.
   - Refresh the page and confirm the configured signature persists.

## Files likely touched
- `js/app.js`
- `js/settings.js`
- `index.html`
- `css/app.css`

## Notes
- This is a lightweight client-only app with no existing Markdown dependency, so the renderer should remain dependency-free.
- The current renderer is simple, so the replacement should prioritize correctness and security over full CommonMark support.
