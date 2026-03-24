#!/usr/bin/env bash
set -e

# Navigate to project folder (needed when double-clicked from Finder)
cd "$(dirname "$0")"

echo "=============================="
echo "  Backlink Analyser Setup"
echo "=============================="
echo

# --- Install prerequisites automatically via Homebrew ---

# Homebrew
if ! command -v brew &>/dev/null; then
    echo "Installing Homebrew (you may be asked for your Mac password)..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Add Homebrew to PATH for this session (Apple Silicon path)
    if [ -f /opt/homebrew/bin/brew ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -f /usr/local/bin/brew ]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
fi

# Python
if ! command -v python3 &>/dev/null; then
    echo "Installing Python 3..."
    brew install python
fi

# Node.js
if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
    echo "Installing Node.js..."
    brew install node
fi

# Rust
if ! command -v cargo &>/dev/null; then
    echo "Installing Rust..."
    brew install rust
fi

echo "All prerequisites ready."
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
