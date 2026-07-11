# Bible Companion

A lightweight, installable Bible reader with AI-powered commentary and a Prayer Companion mode for Markdown prayer lists. Built for focused study with a clean, themeable web interface. Settings, API keys, and generated prayer text are stored in plain text in `localStorage` for local-only personal use.

This version runs entirely in the browser. Server-side dependencies, SQLite persistence, and authentication layers have been removed, so the app relies on local storage and optional OpenAI-compatible API endpoints for AI features.

## Current Status

- **Production-ready PWA** — Fully client-side progressive web app with offline Bible text available after installation.
- **BSB Bible Reader** — Full Berean Standard Bible text with Strong's number annotations and chapter navigation.
- **AI Commentary with Multiple Intents** — Eight built-in intent types: Commentary, Cross-References, Historical Context, Word Study, Application, Discussion Questions, Summary, and Cross-Commentary (comparing theologians).
- **Interactive Chat** — Follow-up questions on any AI response, powered by a configurable small model for context-aware suggestions.
- **Prayer Companion** — Create and format Markdown prayer lists, enhance them with AI, copy them, save them locally, and undo AI edits.
- **Email Distribution** — Add recipients, customize email greeting and subject, and send prayer lists via email.
- **Multi-Provider Support** — Configure multiple OpenAI-compatible API providers (OpenAI, LiteLLM, Ollama, etc.) with separate commentary, prayer, and small models per provider.
- **Three Themes** — Light (Classic), Dark, and Modern (Slate) themes with full theme persistence.
- **Tabbed Bible Reading** — Folder-style tab switcher between Bible and Prayer modes; book tabs nested under Bible mode for multi-chapter study.
- **Toast Notifications** — Status feedback for save, copy, enhancement, and error states.

## Architecture

```
Bible_Companion/
├── index.html              # Main web app (PWA)
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker for offline caching
├── css/app.css             # Themeable styles (Light, Dark, Modern Slate)
├── js/
│   ├── app.js              # Main app logic, AI panel, Prayer Companion, tabs, and intents (2327 lines)
│   ├── bible.js            # Bible navigation and verse loading (151 lines)
│   └── settings.js         # Settings modal, providers, models, localStorage persistence (724 lines)
├── bibles/                 # BSB source EPUB data
├── data/
│   └── bsb-strongs.json    # Strong's number concordance data (21 MB)
├── bsb-data/               # BSB preprocessing pipeline and raw data
│   ├── ATTRIBUTION.md      # Required BSB/TH-OLD attribution
│   ├── output/             # Preprocessed Bible data
│   └── scripts/            # Python build and conversion scripts
└── scripts/                # Python data processing helpers
```

## Storage

Settings (provider list, API keys, model selections, theme, prayer signature, email greeting/subject), saved prayer text, open Bible tabs, and conversation history are stored in the browser's `localStorage`. The Prayer Companion undo state is available during the current editor session.

**Warning:** No server-side encryption or authentication is applied, so plain text API keys and local prayer text are accessible locally. This application must only be used locally.

## Requirements

- A modern web browser with `localStorage` and service worker support
- An OpenAI-compatible API endpoint for AI commentary (e.g., OpenAI, LiteLLM, Ollama, any v1/chat/completions-compatible server)

## Setup

No build step required. Simply open `index.html` in a browser, or serve via any static file server:

```bash
# Quick local server
python3 -m http.server 8080
# Then open http://localhost:8080
```

### First Run

1. Click the settings gear icon in the header
2. In the **Providers** tab, enter your API endpoint URL (e.g., `https://api.openai.com/v1/chat/completions`) and API key
3. In the **Models** tab, select a model for Commentary (required), Prayer (optional, defaults to Commentary), and Small (optional, used for follow-up questions)
4. Save and begin reading

### Installing as PWA

Most browsers offer an "Install" button in the address bar. The app installs standalone with offline Bible text available without a network connection.

## Bible Data

This project uses the Berean Standard Bible (BSB) translated text, which is released under CC0 (Public Domain). The text is enriched with Strong's concordance numbers for original-language word lookups.

The `bsb-data/` directory contains a preprocessing pipeline (forked from a BSB data pipeline project) that converts BSB-USJ source data into optimized JSONL and plain-text formats.

## License

This project (original web app code) is licensed under the MIT License. See [LICENSE](LICENSE) for details.

The BSB Bible text and preprocessing scripts carry their own licenses (CC0, CC-BY 4.0, etc.). See [ATTRIBUTION.md](bsb-data/ATTRIBUTION.md) for full details.

## Acknowledgments

See [ATTRIBUTION.md](ATTRIBUTION.md) for complete credit to all data sources and upstream contributors.
