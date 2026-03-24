# Quick Start

## Prerequisites

Install these before starting:

- **Python 3** — [python.org/downloads](https://www.python.org/downloads/)
- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **Rust** — [rustup.rs](https://rustup.rs/)

## First-Time Setup

Run this once after cloning:

```
./setup.sh
```

This installs all dependencies and builds the ingester. Takes a few minutes the first time.

## Start the App

```
python run.py
```

Then open **http://localhost:5173** in your browser.

## Load Data

1. Put your Ahrefs CSV/TSV backlink exports in the `data/` folder
2. Run `python cli.py ingest`
3. Refresh your browser

## Troubleshooting

| Problem | Fix |
|---|---|
| `setup.sh: Permission denied` | Run `chmod +x setup.sh` first |
| Port already in use | Close other servers on ports 8000 or 5173 |
| No profiles showing | Make sure you've added CSV files and run `python cli.py ingest` |
