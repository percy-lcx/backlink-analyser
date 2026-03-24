#!/usr/bin/env bash

# Navigate to project folder (needed when double-clicked from Finder)
cd "$(dirname "$0")"

echo "Starting Backlink Analyser..."
echo
echo "The app will open at: http://localhost:5173"
echo "Press Ctrl+C in this window to stop."
echo

python3 run.py
