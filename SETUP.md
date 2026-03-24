# Quick Start

## Prerequisites

Install these first (click the links):

- **Python 3** — [python.org/downloads](https://www.python.org/downloads/)
- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **Rust** — [rustup.rs](https://rustup.rs/)

## First-Time Setup

Double-click **`setup.command`** in Finder. This installs everything — takes a few minutes the first time.

> **macOS security warning?** If you see "cannot be opened because it is from an unidentified developer", right-click the file and choose **Open** instead.

## Start the App

Double-click **`start.command`** in Finder.

Then open **http://localhost:5173** in your browser.

To stop the app, press `Ctrl+C` in the Terminal window, or just close it.

## Load Data

1. Drag your Ahrefs CSV/TSV backlink exports into the `data` folder
2. Open **http://localhost:8000/api/ingest** in your browser (this processes the files)
3. Refresh the app in your browser

## Troubleshooting

| Problem | Fix |
|---|---|
| macOS blocks the file | Right-click the `.command` file > choose **Open** |
| Port already in use | Close other servers on ports 8000 or 5173 |
| No profiles showing | Make sure you've added CSV files to `data/` and ingested them |
