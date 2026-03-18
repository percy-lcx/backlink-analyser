import asyncio
import os
import subprocess
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Resolve paths relative to project root (one level up from backend/)
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from fastapi.middleware.cors import CORSMiddleware

from db import init_db, refresh_views
from analysis.profile_terms import invalidate_cache as invalidate_profile_cache
from routes import (
    overview,
    links,
    anchors,
    domains,
    velocity,
    pages,
    redirects,
    quality,
    sitewide,
    compare,
    gap,
    intersect,
    target_paths,
    broken,
    session,
    blocklist,
    anchor_settings,
    keywords,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialise DuckDB and create the backlinks view
    init_db()
    yield
    # Shutdown: nothing to clean up


app = FastAPI(title="Backlink Analyser API", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(overview.router)
app.include_router(links.router)
app.include_router(anchors.router)
app.include_router(domains.router)
app.include_router(velocity.router)
app.include_router(pages.router)
app.include_router(redirects.router)
app.include_router(quality.router)
app.include_router(sitewide.router)
app.include_router(compare.router)
app.include_router(gap.router)
app.include_router(intersect.router)
app.include_router(target_paths.router)
app.include_router(broken.router)
app.include_router(session.router)
app.include_router(blocklist.router)
app.include_router(anchor_settings.router)
app.include_router(keywords.router)


class IngestRequest(BaseModel):
    files: Optional[list[str]] = None


@app.post("/api/ingest")
async def ingest(request: IngestRequest = IngestRequest()):
    """Shell out to the Rust ingester binary and recreate the DuckDB view."""
    binary = os.path.join(_PROJECT_ROOT, "ingester", "target", "release", "backlink-ingest")
    data_dir = os.path.join(_PROJECT_ROOT, "data")
    store_dir = os.path.join(_PROJECT_ROOT, "store")
    cmd = [binary, "--source", data_dir, "--output", store_dir]

    if request.files:
        for f in request.files:
            if os.path.isabs(f) or ".." in f:
                raise HTTPException(status_code=400, detail=f"Invalid file path: {f}")
        cmd.extend(["--files"] + request.files)

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=_PROJECT_ROOT,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail={
                    "message": "Ingestion failed",
                    "returncode": proc.returncode,
                    "stderr": stderr.decode("utf-8", errors="replace"),
                },
            )

        # Recreate the DuckDB view to pick up new parquet files
        refresh_views()
        invalidate_profile_cache()

        return {
            "status": "ok",
            "message": "Ingestion complete, views refreshed.",
            "stdout": stdout.decode("utf-8", errors="replace"),
        }
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail=f"Ingester binary not found at {binary}",
        )
