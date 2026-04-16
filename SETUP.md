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

### If port 8000 is already in use

Pick any free port (e.g. `8001`) and make sure both sides agree on it.

**Option A — one-command launcher:**

```
cd ~/Desktop/backlink-analyser
python3 run.py --port 8001
```

**Option B — manual, two terminals:**

```
# Terminal 1
cd ~/Desktop/backlink-analyser/backend
python3 -m uvicorn main:app --reload --port 8001

# Terminal 2
cd ~/Desktop/backlink-analyser/frontend
VITE_BACKEND_PORT=8001 npm run dev
```

**Option C — persistent override:** create `frontend/.env.local` with:

```
VITE_BACKEND_PORT=8001
```

Vite picks this up automatically, so you can then just run `npm run dev` as normal.

## Troubleshooting

| Problem | Fix |
|---|---|
| `python3` not found | Install Python 3 from https://www.python.org or via Homebrew |
| `node` not found | Install Node.js from https://nodejs.org or via Homebrew |
| Port 8000 already in use | See [If port 8000 is already in use](#if-port-8000-is-already-in-use) above |
| Port 5173 already in use | Close the other Vite/dev server, or run `npm run dev -- --port 5174` |
| `API 404: Not Found` in the UI | Backend isn't running on the port the frontend expects — see the port section above |
| No profiles showing | Make sure parquet files are in the `store/` folder |
