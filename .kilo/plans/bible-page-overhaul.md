# Bible Page Overhaul - 90s Web Aesthetic

## Goal
Transform the current dark-mode layout into a dynamic, resizable split-panel design styled like Bible pages with a 1990s web aesthetic.

## Design Concept
- **Layout**: Side-by-side split panel on desktop (Bible left, AI right), stacks on mobile
- **Resizable**: Draggable splitter bar between panels
- **Bible Page Look**: Parchment/cream backgrounds, Times New Roman serif text, drop-cap first letters, ornamental section dividers
- **90s Web Vibe**: Beveled/embossed borders (`border-top/left` light + `border-bottom/right` dark), classic color scheme (navy, burgundy, gold), no rounded corners, raised/sunken button effects
- **Toggle**: Light (parchment) and Dark modes with a toggle in settings/header. Dark theme reinterprets the 90s aesthetic with subdued tones, darker parchment feel, and adjusted bevels

## Files to Change

### 1. `index.html`
- Restructure `#main-content` to have a side-by-side layout with a splitter element
- Add a splitter divider between `#bible-reader` and `#ai-panel`
- Wrap panels in a flex container with the splitter
- Add a theme toggle button to the header (next to settings button)
- No Google Fonts needed - use system serif fonts (`Times New Roman`, Georgia)

```html
<main id="main-content">
  <div id="split-container">
    <section id="bible-reader"></section>
    <div id="splitter"></div>
    <section id="ai-panel"></section>
  </div>
</main>
```

### 2. `css/app.css` (major rewrite)
- **Variables**: Switch to warm palette - cream/parchment backgrounds (`#f5e6c8`, `#faf0e6`), navy text, burgundy/gold accents
- **Fonts**: `Times New Roman` / Georgia / serif primary, monospace for code
- **No rounded corners**: 90s aesthetic uses sharp edges
- **Beveled borders**: Buttons and panels get raised/sunken 3D effect
  ```css
  .raised {
    border-top: 2px solid #ccc;
    border-left: 2px solid #ccc;
    border-bottom: 2px solid #333;
    border-right: 2px solid #333;
  }
  .sunken {
    border-top: 2px solid #222;
    border-left: 2px solid #222;
    border-bottom: 2px solid #ddd;
    border-right: 2px solid #ddd;
  }
  ```
- **Background**: Subtle parchment texture via CSS gradient
- **Split panel layout**:
  - `#main-content` = `display: flex; flex-direction: row` on desktop
  - `#bible-reader` and `#ai-panel` = flex items with resizable widths
  - `.splitter` = narrow draggable bar between panels
- **Bible panel**: Parchment card look, drop-cap first letter of first verse, ornamental chapter headings
- **AI panel**: Slightly different parchment tone, sunken border (like inset text)
- **Navigation bar**: 90s toolbar style - raised, gradient or solid color background
- **Buttons**: Raised 3D buttons that "depress" on active (border swap)
- **Modal**: 90s dialog box style - sharp corners, beveled borders, system font title bar
- **Scrollbar**: Custom styled to match
- **Ornamental dividers**: CSS-based `* * *` or decorative lines between sections
- **Drop cap**: First letter of chapter gets large initial cap via `::first-letter`
- **Responsive**: Mobile = stacked, no splitter drag

### 3. `js/app.js`
- Add splitter drag logic using mousedown/mousemove/mouseup events
- Persist splitter percentage to localStorage (`bibleCompanion_splitter`)
- Initialize splitter to 60/40 default (Bible 60%, AI 40%)
- Handle window resize to clamp splitter to valid range (20% - 80%)
- Add dark/light theme toggle handler
- Persist theme preference to localStorage (`bibleCompanion_theme`)
- On load, check localStorage for theme and splitter position

### 4. `js/settings.js`
- No changes needed

### 5. `js/bible.js`
- No changes needed

## Detailed CSS Changes

### New Variables
```
/* Light (default) */
--parchment: #faf0e6;
--parchment-dark: #f0deb4;
--bible-bg: #fffef5;
--ai-bg: #f5e6c8;
--text-primary: #2c1810;
--text-secondary: #5c4033;
--navy: #1a2744;
--burgundy: #8b1a1a;
--gold: #b8860b;
--gold-light: #daa520;
--border-light: #d4c5a9;
--border-dark: #6b5b3a;
--bevel-light: #ffffff;
--bevel-dark: #6b5b3a;
--body-bg: #d4c5a9;

/* Dark mode overrides via [data-theme="dark"] */
--parchment: #1e1e2e;
--parchment-dark: #1a1a28;
--bible-bg: #252538;
--ai-bg: #222234;
--text-primary: #d4c5a9;
--text-secondary: #a89b82;
--navy: #4a5580;
--burgundy: #b84040;
--gold: #b8860b;
--gold-light: #daa520;
--border-light: #3a3a52;
--border-dark: #12121e;
--bevel-light: #3a3a52;
--bevel-dark: #0a0a12;
--body-bg: #16162a;
```

### Dark Mode
- Toggle button in header (sun/moon icon or "Light/Dark" text)
- Saves preference to localStorage
- Dark theme preserves 90s beveled/raised button effect but uses dark-appropriate colors
- Parchment becomes dark stone/metal tones
- Bevels flip: light border uses dark gray, dark border uses near-black
- Both themes use serif fonts and sharp corners

### Split Panel Structure
```html
<main id="main-content">
  <div id="split-container">
    <section id="bible-reader"></section>
    <div id="splitter"></div>
    <section id="ai-panel"></section>
  </div>
</main>
```

### Splitter Styling
- Width: 8px, cursor: col-resize
- Background: gradient or 90s grip pattern
- Hover: highlight effect
- Active: wider glow

### Bible Panel Styling
- Background: `--bible-bg` with subtle CSS noise/gradient for parchment feel
- Font: Times New Roman, 18px base
- `::first-letter` on first verse: 3em drop cap with burgundy color
- Chapter heading: centered, gold underline, ornamental caps using `::before` / `::after` with `&#10053;` or similar
- Verse numbers: superscript burgundy instead of accent blue
- Selection highlight: gold tint

### AI Panel Styling
- Background: `--ai-bg` (slightly darker parchment)
- Sunken border effect
- Markdown rendered text in serif, headers in burgundy
- Code blocks: dark background with monospace

### 90s-Style Buttons
- Raised with 3D bevel borders
- Navy background, white text, Times New Roman
- :active flips borders to look pressed
- Hover: slightly brighter background

### 90s-Style Modal
- Title bar: solid navy background, white text, close button in top-right
- Body: cream/sunken background, sharp corners
- No backdrop blur (remove modern glassmorphism), use solid opaque overlay
- 90s window chrome feel

### Theme Toggle
- Button in header, between title and settings
- Simple sun/moon icon or text label
- Toggles `data-theme="dark"` attribute on `<html>` or `<body>`
- Saves to localStorage

### Select Dropdowns
- Styled to match 90s aesthetic
- Beveled borders, serif font, parchment background

## Implementation Order
1. CSS variable overhaul + new color/typography scheme
2. HTML restructuring for split layout with splitter element
3. Split panel CSS (side-by-side layout)
4. Splitter JS drag behavior
5. Bible panel styling (parchment, drop cap, ornaments)
6. AI panel styling (inset parchment)
7. 90s buttons, selects, and controls
8. Modal redesign
9. Responsive adjustments
10. Polish: scrollbars, tooltips, selection colors
