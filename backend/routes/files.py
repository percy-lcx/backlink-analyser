"""Endpoints for managing data and store files."""

import os
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, UploadFile, File

from db import refresh_views
from analysis.profile_terms import invalidate_cache as invalidate_profile_cache

router = APIRouter()

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_ALLOWED_DIRS = {"data/backlinks", "data/keywords", "store", "store/keywords"}


def _resolve_dir(dir_key: str) -> str:
    if dir_key not in _ALLOWED_DIRS:
        raise HTTPException(status_code=400, detail=f"Invalid directory: {dir_key}")
    return os.path.join(_PROJECT_ROOT, dir_key)


def _validate_filename(name: str) -> None:
    if not name or ".." in name or "/" in name or "\\" in name:
        raise HTTPException(status_code=400, detail=f"Invalid filename: {name}")


@router.get("/api/files")
def list_files(dir: str = Query(...)):
    abs_dir = _resolve_dir(dir)
    if not os.path.isdir(abs_dir):
        return {"files": []}
    entries = []
    for fname in sorted(os.listdir(abs_dir)):
        fpath = os.path.join(abs_dir, fname)
        if not os.path.isfile(fpath):
            continue
        stat = os.stat(fpath)
        entries.append({
            "name": fname,
            "size": stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        })
    return {"files": entries}


@router.post("/api/files/upload")
async def upload_files(dir: str = Query(...), files: list[UploadFile] = File(...)):
    abs_dir = _resolve_dir(dir)
    os.makedirs(abs_dir, exist_ok=True)
    saved = []
    for f in files:
        _validate_filename(f.filename)
        dest = os.path.join(abs_dir, f.filename)
        content = await f.read()
        with open(dest, "wb") as out:
            out.write(content)
        saved.append(f.filename)
    return {"status": "ok", "saved": saved}


@router.delete("/api/files")
def delete_file(dir: str = Query(...), name: str = Query(...)):
    abs_dir = _resolve_dir(dir)
    _validate_filename(name)
    fpath = os.path.join(abs_dir, name)
    if not os.path.isfile(fpath):
        raise HTTPException(status_code=404, detail=f"File not found: {name}")
    os.remove(fpath)
    # If deleting from store, refresh DuckDB views
    if dir.startswith("store"):
        refresh_views()
        invalidate_profile_cache()
    return {"status": "ok"}
