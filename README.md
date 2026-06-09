# Bible Companion

A lightweight, installable Bible reader with AI-powered commentary. Built for focused study with a clean, dark-themed web interface. Settings are stored in plain text in localStorage -- suitable for local-only personal use.

This version has been simplified to run purely client-side. All previous server-side dependencies, SQLite persistence, and authentication layers have been removed, relying solely on local storage.

## Features

- **BSB Bible Text** — Full berean Standard Bible with Strong's number annotations
- **AI Commentary** — Send selected verses to any OpenAI-compatible endpoint for AI-powered analysis
- **Installable PWA** — Works offline as a progressive web app on desktop and mobile
- **Plain-Text Settings** — API keys and preferences stored in localStorage
- **Settings Panel** — Configure API endpoint, key, and model name per your LLM provider
- **Keyboard Shortcuts** — `Ctrl+Enter` to send selected verses to AI

## Architecture

```
Bible_Companion/
├── index.html              # Main web app (PWA)
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker for offline caching
├── css/app.css             # Dark theme styles
├── js/
│   ├── app.js              # Main app logic and AI panel
│   ├── bible.js            # Bible navigation and verse loading
│   └── settings.js         # Settings modal and localStorage persistence
├── bibles/                 # Parsed Bible text (BSB)
├── data/
│   └── bsb-strongs.json    # Strong's number concordance data
├── bsb-data/               # BSB preprocessing pipeline and raw data
│   ├── ATTRIBUTION.md      # Required BSB/TH-OLD attribution
│   ├── output/             # Preprocessed Bible data
│   └── scripts/            # Python build and conversion scripts
└── scripts/                # Python data processing helpers
```

## Storage

Settings (API endpoint, key, and model) are stored in plain JSON format in the browser's localStorage.

**Warning:** No server-side encryption or authentication is applied, so plain text API keys are accessible locally. This application must only be used locally.

## Requirements

- A modern web browser with localStorage support
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
2. Enter your API endpoint URL (e.g., `https://api.openai.com/v1/chat/completions`)
3. Optionally provide an API key and model name
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
