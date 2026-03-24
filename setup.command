#!/usr/bin/env bash
set -e

# Navigate to project folder (needed when double-clicked from Finder)
cd "$(dirname "$0")"

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
    echo "Please install the missing tools above, then double-click this file again."
    echo
    read -p "Press Enter to close..."
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
cd ..

# --- Install Python dependencies ---

echo "[3/4] Installing Python dependencies..."
pip3 install -r backend/requirements.txt

# --- Install frontend dependencies ---

echo "[4/4] Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo
echo "=============================="
echo "  Setup complete!"
echo "=============================="
echo
echo "Next step: Double-click 'start.command' to launch the app."
echo
read -p "Press Enter to close..."
