"""File-based workspace storage for grouping datasets by vertical/niche."""

from __future__ import annotations

import json
import os

_STORE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "store"
)
_WORKSPACES_PATH = os.path.join(_STORE_DIR, "workspaces.json")

_DEFAULT = {"active": None, "workspaces": {}}


def get_workspaces() -> dict:
    """Read the full workspaces config from disk."""
    if not os.path.exists(_WORKSPACES_PATH):
        return dict(_DEFAULT)
    with open(_WORKSPACES_PATH, "r") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        return dict(_DEFAULT)
    return data


def set_workspaces(data: dict) -> None:
    """Write the full workspaces config to disk."""
    os.makedirs(_STORE_DIR, exist_ok=True)
    with open(_WORKSPACES_PATH, "w") as f:
        json.dump(data, f, indent=2)


def get_active_workspace() -> str | None:
    """Return the name of the active workspace, or None for 'All'."""
    ws = get_workspaces()
    return ws.get("active")


def set_active_workspace(name: str | None) -> None:
    """Set the active workspace (None means 'All')."""
    ws = get_workspaces()
    ws["active"] = name
    set_workspaces(ws)


def get_active_datasets() -> list[str] | None:
    """Return dataset labels for the active workspace, or None if showing all."""
    ws = get_workspaces()
    active = ws.get("active")
    if not active:
        return None
    workspaces = ws.get("workspaces", {})
    entry = workspaces.get(active)
    if not entry:
        return None
    return entry.get("datasets", [])
