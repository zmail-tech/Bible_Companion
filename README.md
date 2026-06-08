# Bible Companion

A lightweight, installable Bible reader with AI-powered commentary. Built for focused study with a clean, dark-themed web interface. Features secure multi-user authentication and fully encrypted per-user settings.

## Features

- **BSB Bible Text** — Full Berean Standard Bible with Strong's number annotations
- **AI Commentary** — Send selected verses to any OpenAI-compatible endpoint for AI-powered analysis
- **Installable PWA** — Works offline as a progressive web app on desktop and mobile
- **Multi-User Authentication** — Registration and login with PBKDF2-hashed passwords
- **Encrypted Settings** — Per-user API keys and preferences encrypted with AES-GCM in a local SQLite database
- **Login Gate** — AI features are locked until authentication
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
│   ├── auth.js             # User registration, login, and session management
│   ├── sqlite.js           # In-browser SQLite (sql.js) database layer
│   ├── settings.js         # Settings modal and persistence
│   └── crypto.js           # PBKDF2 hashing and AES-GCM encryption utilities
├── bibles/                 # Parsed Bible text (BSB)
├── data/
│   └── bsb-strongs.json    # Strong's number concordance data
├── bsb-data/               # BSB preprocessing pipeline and raw data
│   ├── ATTRIBUTION.md      # Required BSB/TH-OLD attribution
│   ├── output/             # Preprocessed Bible data
│   └── scripts/            # Python build and conversion scripts
├── scripts/                # Python data processing helpers
└── vendor/
    └── sql-wasm.js         # Patched sql.js WASM module
```

## Security & Storage

The application uses a in-browser SQLite database (`sql.js`) backed by IndexedDB for persistence. All sensitive data is handled as follows:

- **Passwords** hashed using PBKDF2 (SHA-256, 100,000 iterations) via the Web Crypto API
- **API keys** encrypted per-user using AES-GCM, with the encryption key derived from the user's password
- **Settings** stored as encrypted blobs in the `user_settings` SQLite table
- **Login gate** ensures AI features remain inaccessible until authenticated

## Requirements

- A modern web browser with Web Crypto API support
- An OpenAI-compatible API endpoint for AI commentary (e.g., OpenAI, LiteLLM, Ollama, any v1/chat/completions-compatible server)

## Setup

No build step required. Simply open `index.html` in a browser, or serve via any static file server:

```bash
# Quick local server
python3 -m http.server 8080
# Then open http://localhost:8080
```

### First Run

1. Register a new account using the login button
2. Click the settings gear icon in the header
3. Enter your API endpoint URL (e.g., `https://api.openai.com/v1/chat/completions`)
4. Optionally provide an API key and model name
5. Save and begin reading

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
