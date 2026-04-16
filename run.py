#!/usr/bin/env python3
"""Launch both FastAPI backend and Vite dev server."""

import argparse
import os
import signal
import subprocess
import sys

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))


def main():
    parser = argparse.ArgumentParser(description="Launch FastAPI backend and Vite dev server")
    parser.add_argument("--port", type=int, default=8000, help="Backend port (default: 8000)")
    args = parser.parse_args()
    port = args.port

    procs = []

    try:
        # Start FastAPI backend.
        # Run from backend/ so that bare imports like `from db import ...`
        # in backend/main.py resolve correctly.
        print(f"Starting FastAPI backend on http://localhost:{port}")
        backend = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app",
             "--host", "0.0.0.0", "--port", str(port), "--reload"],
            cwd=os.path.join(ROOT_DIR, "backend"),
        )
        procs.append(backend)

        # Start Vite dev server (forward backend port so the proxy targets it)
        print("Starting Vite dev server on http://localhost:5173")
        frontend_env = {**os.environ, "VITE_BACKEND_PORT": str(port)}
        frontend = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=os.path.join(ROOT_DIR, "frontend"),
            env=frontend_env,
        )
        procs.append(frontend)

        print()
        print("=" * 50)
        print(f"  Backend:  http://localhost:{port}")
        print("  Frontend: http://localhost:5173")
        print(f"  API docs: http://localhost:{port}/docs")
        print("=" * 50)
        print()
        print("Press Ctrl+C to stop both servers")

        # Wait for either to exit
        for p in procs:
            p.wait()

    except KeyboardInterrupt:
        print("\nShutting down...")
        for p in procs:
            p.send_signal(signal.SIGTERM)
        for p in procs:
            p.wait()


if __name__ == "__main__":
    main()
