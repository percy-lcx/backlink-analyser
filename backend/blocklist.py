from __future__ import annotations

"""File-based blocklist storage for flagging unhelpful domains.

Supports per-profile overrides.  Storage format (v2):
    {"_global": ["domain1", ...], "profile_name": ["domain2", ...]}

Legacy flat-list format is auto-migrated on first read.
"""

import json
import os
import re

_STORE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "store"
)
_BLOCKLIST_PATH = os.path.join(_STORE_DIR, "blocklist.json")


def _read() -> dict:
    if not os.path.exists(_BLOCKLIST_PATH):
        return {"_global": []}
    with open(_BLOCKLIST_PATH, "r") as f:
        data = json.load(f)
    # Auto-migrate legacy flat list → dict
    if isinstance(data, list):
        migrated = {"_global": data}
        _write_raw(migrated)
        return migrated
    return data if isinstance(data, dict) else {"_global": []}


def _write_raw(data: dict) -> None:
    os.makedirs(_STORE_DIR, exist_ok=True)
    with open(_BLOCKLIST_PATH, "w") as f:
        json.dump(data, f, indent=2)


def _clean(d: str) -> str:
    return re.sub(r"^https?://", "", d.strip().lower()).rstrip("/")


def get_blocklist(profile: str | None = None) -> list[str]:
    """Return the effective blocklist for a profile (or global)."""
    data = _read()
    if profile and profile in data:
        return data[profile]
    return data.get("_global", [])


def has_custom_blocklist(profile: str) -> bool:
    """Check whether a profile has its own custom blocklist."""
    data = _read()
    return profile in data and profile != "_global"


def set_blocklist(domains: list[str], profile: str | None = None) -> None:
    """Write the blocklist for a profile (or global)."""
    data = _read()
    unique = sorted(set(_clean(d) for d in domains if d.strip()))
    key = profile if profile else "_global"
    data[key] = unique
    _write_raw(data)


def clear_profile_blocklist(profile: str) -> None:
    """Remove a profile's custom blocklist, reverting to global."""
    data = _read()
    data.pop(profile, None)
    _write_raw(data)
