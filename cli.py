#!/usr/bin/env python3
"""CLI wrapper for backlink analyser operations."""

import argparse
import subprocess
import sys
import os

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
INGESTER_BIN = os.path.join(ROOT_DIR, "ingester", "target", "release", "backlink-ingest")
DATA_DIR = os.path.join(ROOT_DIR, "data")
STORE_DIR = os.path.join(ROOT_DIR, "store")


def cmd_ingest(args):
    """Run the Rust ingester."""
    source = args.source or DATA_DIR
    output = args.output or STORE_DIR

    if not os.path.isfile(INGESTER_BIN):
        print(f"Ingester binary not found at {INGESTER_BIN}")
        print("Build it with: cd ingester && cargo build --release")
        sys.exit(1)

    cmd = [INGESTER_BIN, "--source", source, "--output", output]
    if args.files:
        cmd.extend(["--files"] + args.files)
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=ROOT_DIR)
    sys.exit(result.returncode)


def cmd_serve(args):
    """Start the FastAPI backend."""
    import uvicorn
    os.chdir(ROOT_DIR)
    uvicorn.run("backend.main:app", host="0.0.0.0", port=args.port, reload=args.reload)


def main():
    parser = argparse.ArgumentParser(description="Backlink Analyser CLI")
    sub = parser.add_subparsers(dest="command")

    # ingest
    p_ingest = sub.add_parser("ingest", help="Run the Rust ingester")
    p_ingest.add_argument("--source", help=f"Source directory (default: {DATA_DIR})")
    p_ingest.add_argument("--output", help=f"Output directory (default: {STORE_DIR})")
    p_ingest.add_argument("--files", nargs="+", help="Specific CSV/TSV file(s) to ingest (default: all files in source dir)")
    p_ingest.set_defaults(func=cmd_ingest)

    # serve
    p_serve = sub.add_parser("serve", help="Start the FastAPI backend")
    p_serve.add_argument("--port", type=int, default=8000)
    p_serve.add_argument("--reload", action="store_true")
    p_serve.set_defaults(func=cmd_serve)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
