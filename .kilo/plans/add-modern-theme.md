# Add Modern Dark/Slate Theme

## Overview

Add a third "modern" theme with a dark slate aesthetic: charcoal backgrounds, cool blue/teal accents, sans-serif typography, flat design, and rounded corners. Theme selection will be via a dropdown in the Settings modal.

## Changes

### 1. `css/app.css` — Add `[data-theme="modern"]` CSS variables

Add a new theme block after the existing `[data-theme="dark"]` block with modern design tokens:

| Variable | Modern Value | Rationale |
|---|---|---|
| `--parchment` | `#1e2028` | Panel bg — dark slate |
| `--parchment-dark` | `#181a20` | Secondary panel bg |
| `--bible-bg` | `#1a1d24` | Bible reader bg |
| `--ai-bg` | `#181b22` | AI panel bg |
| `--text-primary` | `#e2e4e9` | Clean light text |
| `--text-secondary` | `#9ca0ab` | Muted secondary text |
| `--text-muted` | `#6b7080` | Subtle text |
| `--navy` | `#0f1117` | Header bar — near-black |
| `--burgundy` | `#3b82f6` | Accent — blue (replaces burgundy) |
| `--gold` | `#06b6d4` | Accent — cyan/teal (replaces gold) |
| `--gold-light` | `#22d3ee` | Bright teal for hovers |
| `--border-light` | `#2d3140` | Subtle border |
| `--border-dark` | `#11131a` | Dark border |
| `--bevel-light` | `#2d3140` | Flat design (no 3D effect) |
| `--bevel-dark` | `#11131a` | Flat design |
| `--body-bg` | `#13151b` | Page bg — dark charcoal |
| `--accent-hover` | `#60a5fa` | Blue hover |
| `--accent-light` | `rgba(59, 130, 246, 0.12)` | Transparent blue |
| `--verse-selected` | `rgba(6, 182, 212, 0.2)` | Cyan highlight |
| `--verse-hover` | `rgba(59, 130, 246, 0.08)` | Blue hover |
| `--success` | `#22c55e` | Green |
| `--error` | `#ef4444` | Red |
| `--warning` | `#f59e0b` | Amber |
| `--modal-overlay` | `rgba(0, 0, 0, 0.75)` | Backdrop |

### 2. `css/app.css` — Modern-style overrides

Add `[data-theme="modern"]` scoped rules for elements that need structural style changes (not just color swaps):

- **Font**: Change `body`, all text elements to a modern sans-serif stack: `Inter, system-ui, -apple-system, "Segoe UI", sans-serif`
- **Borders**: Remove 3D bevel effect → use flat `1px solid var(--border-light)` borders
- **Border radius**: Add subtle `border-radius: 8px` on panels, buttons, inputs, and the modal
- **Scrollbar**: Simplify to thin, flat scrollbars (no 3D bevel track/thumb)
- **Drop cap**: Remove or simplify the decorative drop cap on first verse
- **Chapter heading decorative flourishes**: Remove the star ornaments (`\273F`)
- **Body background**: Remove the line-rule repeating gradient → solid color only
- **Buttons**: Flat design with subtle shadow instead of 3D bevel borders

Key selectors to override:
- `body` — font-family, remove bg-image
- `#navigation-bar` — flat border, border-radius
- `.nav-group select` — flat border, border-radius, font-family
- `.icon-btn`, `.btn-primary`, `.btn-secondary` — flat design, border-radius, remove 3D borders
- `.verse-paragraph:first-of-type .verse:first-of-type::first-letter` — simplify/remove drop cap
- `.chapter-heading::before` — remove decorative stars
- `.chapter-heading` — remove double border, use single line
- `.strongs-tooltip` — flat design, border-radius
- `.modal-content` — border-radius, remove 3D border, add box-shadow
- `.modal-header` — border-radius top
- `.form-group input` — flat border, border-radius
- Scrollbar pseudo-elements — thin flat style
- `#splitter` — flat design
- `#ai-response` — flat inset
- `#ai-response pre`, `code` — flat design, border-radius
- `.status-message` — flat design
- `.section-heading.s1` — single border instead of gold underline

### 3. `js/app.js` — Update `initTheme()` 

Replace the 2-way toggle with a 3-theme system:

- Read saved theme from localStorage: `"light"`, `"dark"`, or `"modern"`
- Set `data-theme` attribute accordingly (`""` for light, `"dark"` or `"modern"` otherwise)
- Remove the header toggle button's click handler (theme selection moves to settings)
- Keep the header button visible but change tooltip/title text to indicate it's informational, OR remove the header toggle entirely and rely on settings

Actually: keep the header toggle as a quick light/dark cycle for convenience, but the settings dropdown is the authoritative selector.

### 4. `index.html` — Theme toggle icon swap

Update the theme toggle button to support icon state per theme. Add both sun and moon SVG icons, toggle visibility via CSS based on `data-theme`. For `"modern"`, show a distinct icon (sparkle/diamond).

Alternatively: Remove the header toggle button entirely since theme selection moved to settings. Replace with a simple info icon or remove it. Given the user said "dropdown in settings," removing the toggle is cleaner.

**Decision**: Remove the `#theme-toggle` button. Users select themes via the settings dropdown only.

### 5. `index.html` — Add theme dropdown to settings modal

Add a new form-group in the settings form (before the API fields):

```html
<div class="form-group">
  <label for="theme-select">Theme</label>
  <select id="theme-select">
    <option value="light">Light (Classic)</option>
    <option value="dark">Dark</option>
    <option value="modern">Modern (Slate)</option>
  </select>
</div>
```

### 6. `js/settings.js` — Wire up theme dropdown

In `initSettingsModal()`:
- Get reference to `#theme-select`
- On `openModal`, set dropdown value from `localStorage.getItem("bibleCompanion_theme")` (default `"light"`)
- On dropdown `change`, update `data-theme` attribute on `<html>`, save to localStorage, and update the meta theme-color tag

### 7. `js/settings.js` — Update settings form submit

The settings form submit should NOT reset close the modal on theme change. Theme change is immediate (no submit needed). The dropdown change handler applies the theme directly.

### 8. Meta theme-color update

Add a function that updates `<meta name="theme-color">` content when theme changes:
- Light: `#d4c5a9`
- Dark: `#1a1a2e`
- Modern: `#13151b`

## Implementation Order

1. CSS variables block for `[data-theme="modern"]` in `app.css`
2. Modern-style structural overrides in `app.css`
3. Remove `#theme-toggle` button from `index.html`
4. Add theme dropdown to settings modal in `index.html`
5. Update `initTheme()` in `app.js` for 3 themes
6. Wire up dropdown in `settings.js` with immediate apply

## Files Modified

- `css/app.css` — New theme variables + modern style overrides
- `index.html` — Remove toggle, add dropdown
- `js/app.js` — Update theme init logic
- `js/settings.js` — Wire up dropdown
