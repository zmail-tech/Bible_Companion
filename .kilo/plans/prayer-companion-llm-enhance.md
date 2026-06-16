# Prayer Companion LLM Enhancement Plan

## Goal
Add a Prayer Companion enhancement flow that sends the current prayer request text to the currently selected LLM provider/model and replaces it with a lightly edited version. The edit should preserve the writer's meaning while correcting spelling, punctuation, sentence structure, and clarity.

## Current app context
- `index.html:95-118` adds Prayer mode markup: toolbar, textarea, preview, signature, copy, and save.
- `js/app.js:909-1074` owns Prayer mode state, save/restore, preview, copy, and splitter behavior.
- `js/app.js:704-854` owns the active LLM provider/model request path and streaming response handling.
- `js/settings.js:50-56` exposes `getActiveProvider()` for the current provider/model.
- `css/app.css:1475-1840` already has Prayer mode layout and responsive styling.

## Proposed implementation
1. **Prayer enhancement controls**
   - In Prayer mode, add a prayer style selector and an `Enhance with AI` button in the prayer toolbar.
   - Add an optional confidentiality note field for Style 3.
   - Persist the selected style with `localStorage`, similar to the existing AI intent selector.

2. **Style options**
   - Use the three user-provided styles as selectable prayer enhancement styles:
     - `concise`: The Concise "Quick-Share" Prompt.
     - `narrative`: The "Contextual Narrative" Prompt.
     - `intercessory`: The "Intercessory Focus" Prompt.
   - Add a shared safety layer to every prompt:
     - Make only light edits for clarity, grammar, spelling, punctuation, and structure.
     - Preserve the original meaning, names, details, and tone.
     - Do not add facts, assumptions, or new prayer targets.
     - Return the refined prayer request only, without explanations.

3. **AI request flow**
   - Implement `enhancePrayerWithAI()` in `js/app.js`.
   - Reuse `getActiveProvider()` so the request uses the currently selected provider/model.
   - Use the same fetch pattern as `sendToAI()`, including the active endpoint, optional API key, and streaming support.
   - When complete, replace `#prayer-textarea` with the returned text and refresh the preview.
   - Show `Enhancing...`, `Saved`, and error states through `#prayer-status`.

4. **System prompt**
   - Add a Prayer enhancement system prompt near `SYSTEM_PROMPT`.
   - The system prompt should tell the LLM it is acting as a careful prayer editor, not a content generator.
   - It should keep edits minimal and avoid changing the request's intent.

5. **CSS**
   - Add Prayer-specific toolbar controls and style selector styling.
   - Add modern-theme overrides where needed.
   - Ensure responsive behavior still stacks textarea and preview below `768px`.

6. **Validation**
   - Open the app locally.
   - Switch to Prayer mode.
   - Enter prayer text and verify preview updates.
   - Select each enhancement style and verify the LLM request uses the correct prompt.
   - Confirm the enhanced output replaces the textarea text and updates the preview.
   - Verify active provider/model behavior and error states.

## Files to change
- `index.html` — add Prayer enhancement controls.
- `js/app.js` — add enhancement prompts, style selector persistence, AI request function, and UI status handling.
- `css/app.css` — style Prayer enhancement controls and responsive behavior.

## Risks and mitigations
- **Risk:** Style prompts may encourage substantive rewriting.
  - **Mitigation:** Add explicit minimal-edit constraints to every prompt.
- **Risk:** Prayer mode hides existing AI controls, so enhancement must use the active LLM directly.
  - **Mitigation:** Reuse the existing provider fetch logic instead of requiring Bible verse selection.
- **Risk:** Markdown rendering is simple and may not fully match the LLM output.
  - **Mitigation:** Use existing `renderMarkdown()` consistently and test multiline lists, bullets, and scripture references.
