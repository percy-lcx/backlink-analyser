#!/usr/bin/env python3
"""Launch both FastAPI backend and Vite dev server."""

import os
import signal
import subprocess
import sys

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))


def main():
    procs = []

    try:
        # Start FastAPI backend
        print("Starting FastAPI backend on http://localhost:8000")
        backend = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "backend.main:app",
             "--host", "0.0.0.0", "--port", "8000", "--reload"],
            cwd=ROOT_DIR,
        )
        procs.append(backend)

        # Start Vite dev server
        print("Starting Vite dev server on http://localhost:5173")
        frontend = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=os.path.join(ROOT_DIR, "frontend"),
        )
        procs.append(frontend)

        print()
        print("=" * 50)
        print("  Backend:  http://localhost:8000")
        print("  Frontend: http://localhost:5173")
        print("  API docs: http://localhost:8000/docs")
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
