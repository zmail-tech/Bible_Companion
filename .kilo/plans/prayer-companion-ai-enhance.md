# Prayer Companion AI Enhancement Plan

## Goal
Replace the Prayer Companion enhancement dropdown modes with a simple `Enhance with AI` action. When invoked, the app should send the current prayer text to the active AI provider/model and format it as a careful Markdown prayer-request list.

## Current app context
- `index.html:95-140` currently contains Prayer mode controls, including `prayer-style-select`, style options, a confidentiality note row, `enhance-prayer-btn`, `undo-prayer-btn`, textarea, preview, signature, copy, and save.
- `js/app.js:36-79` currently defines `PRAYER_STORAGE_KEY`, `PRAYER_SIGNATURE`, `PRAYER_STYLE_STORAGE_KEY`, `PRAYER_SYSTEM_PROMPT`, `PRAYER_ENHANCE_PROMPTS`, and `DEFAULT_PRAYER_STYLE`.
- `js/app.js:1083-1270` currently implements style-selection-based enhancement, streaming/non-streaming fetch handling, preview refresh, status messages, and undo behavior.
- `js/app.js:706-896` already implements the active provider fetch path used by `sendToAI()`.
- `css/app.css:1516-1856` currently styles the prayer toolbar, style dropdown, confidentiality row, buttons, and responsive Prayer mode layout.

## Proposed implementation
1. **Prayer UI simplification**
   - Remove the `prayer-style-select` dropdown and its stored `bibleCompanion_prayerStyle` logic.
   - Remove the old `concise`, `narrative`, and `intercessory` options.
   - Remove the confidentiality note field unless the user explicitly wants it retained.
   - Leave Prayer mode with a simple toolbar containing the Markdown hint and one `Enhance with AI` button.
   - Remove the `undo-prayer-btn` if the goal is a truly simple enhancement workflow; otherwise keep it as a safety control.

2. **Prayer formatting system prompt**
   - Replace `PRAYER_SYSTEM_PROMPT` with the requested prayer-note writer prompt.
   - Make it the only system prompt used for Prayer enhancement.
   - Keep it explicit that the model must:
     - Output only the formatted prayer request list.
     - Preserve names, relationships, medical details, timelines, and prayer focuses exactly as provided.
     - Not invent facts, diagnoses, outcomes, dates, names, or prayer requests.
     - Use Markdown.
     - Use `##` for major people, couples, families, or groups.
     - Use `###` for nested people or subgroups.
     - Separate major sections with `* * *`.
     - Use bullet points for all details and prayer requests.
     - Start prayer requests with `Pray for...` whenever possible.
     - Bold important facts or clarifications when useful.
     - Preserve uncertainty using phrases like “appears to be,” “seems to be,” or “is dealing with.”
     - Avoid medical advice or clinical conclusions.
     - Ask a short clarifying question if there is too little information.

3. **AI request flow**
   - Keep the existing `enhancePrayerWithAI()` fetch pattern, but simplify the user prompt.
   - Prompt should contain:
     - The final prayer system prompt.
     - The current prayer text as the only source content.
     - A short instruction to convert the raw input into the required Markdown format.
   - Reuse `getActiveProvider()` so Prayer enhancement uses the same active endpoint, model, API key, and streaming behavior as other AI actions.
   - Replace the textarea value with the returned content and call `updatePrayerPreview()`.
   - Preserve status messages for loading, streaming, enhanced, saved, and error states through `#prayer-status`.

4. **State and persistence**
   - Remove `PRAYER_STYLE_STORAGE_KEY` and all dropdown persistence.
   - Keep `PRAYER_STORAGE_KEY` for saving prayer text.
   - If `undo-prayer-btn` is removed, also remove `isEnhancingPrayer`, `updateUndoButton()`, and related dataset handling.
   - If `undo-prayer-btn` is retained, keep the existing undo implementation.

5. **CSS**
   - Remove dropdown styling for `#prayer-style-select`.
   - Remove confidentiality-row CSS and markup.
   - Adjust `#prayer-toolbar` so it centers or right-aligns the single `Enhance with AI` button without extra controls.
   - Preserve responsive behavior for Prayer mode and ensure the toolbar remains usable on mobile.

6. **Validation**
   - Open the app locally.
   - Switch to Prayer Companion.
   - Enter raw prayer details.
   - Confirm there is no prayer style dropdown.
   - Confirm the UI has only a simple `Enhance with AI` action.
   - Verify the LLM returns Markdown matching the requested structure.
   - Verify preview, save, copy, status messages, and active provider/model behavior.
   - Verify no style dropdown persistence remains.

## Files to change
- `index.html` — remove `prayer-style-select`, old style options, confidentiality row, and optionally `undo-prayer-btn`.
- `js/app.js` — replace prayer system prompt, remove style-prompt constants/persistence, simplify enhancement flow, and remove or retain undo logic depending on the final UI decision.
- `css/app.css` — remove dropdown/confidentiality styling and adjust Prayer toolbar layout.

## Risks and mitigations
- **Risk:** The LLM may add invented details or clinical conclusions.
  - **Mitigation:** Use the explicit prompt rules supplied by the user and keep temperature low.
- **Risk:** Removing undo makes the enhancement irreversible.
  - **Mitigation:** Keep the existing save behavior and remove undo only if the user wants a simpler interface.
- **Risk:** Markdown preview may not perfectly render every output pattern.
  - **Mitigation:** Use the existing `renderMarkdown()` and test `##`, `###`, bullets, horizontal rules, bold text, and uncertainty phrases.
