# Quick Start

## Prerequisites

- **Python 3** — check with `python3 --version`
- **Node.js** (v18+) — check with `node --version`

## First-Time Setup

Open a terminal and run:

```
cd ~/Desktop/backlink-analyser
mkdir -p data store
pip install -r backend/requirements.txt
cd frontend && npm install && cd ..
```

## Start the App

**Terminal 1 — Backend**

```
cd ~/Desktop/backlink-analyser/backend
python3 -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend**

```
cd ~/Desktop/backlink-analyser/frontend
npm run dev
```

Then open **http://localhost:5173** in your browser.

To stop, press `Ctrl+C` in each terminal window.

## Troubleshooting

| Problem | Fix |
|---|---|
| `python3` not found | Install Python 3 from https://www.python.org or via Homebrew |
| `node` not found | Install Node.js from https://nodejs.org or via Homebrew |
| Port already in use | Close other servers on ports 8000 or 5173 |
| No profiles showing | Make sure parquet files are in the `store/` folder |
