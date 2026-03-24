#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "=============================="
echo "  Backlink Analyser Setup"
echo "=============================="
echo

# --- Check prerequisites ---

missing=0

if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python 3 is not installed."
    echo "  Install: https://www.python.org/downloads/"
    missing=1
fi

if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
    echo "ERROR: Node.js / npm is not installed."
    echo "  Install: https://nodejs.org/"
    missing=1
fi

if ! command -v cargo &>/dev/null; then
    echo "ERROR: Rust / Cargo is not installed."
    echo "  Install: https://rustup.rs/"
    missing=1
fi

if [ "$missing" -eq 1 ]; then
    echo
    echo "Please install the missing tools above, then re-run this script."
    exit 1
fi

echo "All prerequisites found."
echo

# --- Create directories ---

echo "[1/4] Creating data directories..."
mkdir -p data store

# --- Build Rust ingester ---

echo "[2/4] Building ingester (this may take a few minutes the first time)..."
cd ingester
cargo build --release
cd "$ROOT_DIR"

# --- Install Python dependencies ---

echo "[3/4] Installing Python dependencies..."
pip install -r backend/requirements.txt

# --- Install frontend dependencies ---

echo "[4/4] Installing frontend dependencies..."
cd frontend
npm install
cd "$ROOT_DIR"

echo
echo "=============================="
echo "  Setup complete!"
echo "=============================="
echo
echo "To start the app:"
echo "  python run.py"
echo
echo "Then open http://localhost:5173 in your browser."
echo
echo "To load data:"
echo "  1. Put Ahrefs CSV/TSV exports in the data/ folder"
echo "  2. Run: python cli.py ingest"
echo "  3. Refresh your browser"
