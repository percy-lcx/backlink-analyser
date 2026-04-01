"""File-based storage for per-profile anchor categorization settings."""
from __future__ import annotations

import json
import os

_STORE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "store"
)
_SETTINGS_PATH = os.path.join(_STORE_DIR, "profile-settings.json")

_CURRENT_SCHEMA_VERSION = 2


def _read() -> dict:
    if not os.path.exists(_SETTINGS_PATH):
        return {}
    with open(_SETTINGS_PATH, "r") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        return {}
    # Auto-migrate pre-v2 files: run the old migration once, then stamp version
    if data.get("_schema_version", 1) < 2:
        _migrate_target_keywords(data)
        data["_schema_version"] = _CURRENT_SCHEMA_VERSION
        _write(data)
    return data


def _write(data: dict) -> None:
    os.makedirs(_STORE_DIR, exist_ok=True)
    data["_schema_version"] = _CURRENT_SCHEMA_VERSION
    with open(_SETTINGS_PATH, "w") as f:
        json.dump(data, f, indent=2)


def _clean_list(items: list[str]) -> list[str]:
    """Lowercase, strip, deduplicate, and sort a list of strings."""
    return sorted(set(s.strip().lower() for s in items if s.strip()))


def _migrate_target_keywords(data: dict) -> None:
    """One-time migration: move per-profile target_keywords to _global.

    Only runs for schema_version < 2.  After migration, per-profile
    target_keywords are treated as intentional overrides.
    """
    global_kw: set[str] = set(data.get("_global", {}).get("target_keywords", []))
    for key, val in list(data.items()):
        if key.startswith("_") or not isinstance(val, dict):
            continue
        profile_kw = val.pop("target_keywords", None)
        if profile_kw:
            global_kw.update(profile_kw)
    if global_kw:
        data.setdefault("_global", {})["target_keywords"] = sorted(global_kw)


def get_all_settings() -> dict:
    return _read()


def get_profile_settings(profile: str) -> dict:
    data = _read()
    profile_data = data.get(profile, {})
    result: dict = {
        "branded_terms": profile_data.get("branded_terms", []),
        "excluded_auto_terms": profile_data.get("excluded_auto_terms", []),
        "target_keywords": None,
        "generic_anchors": None,
    }
    # Only return lists when the profile has an explicit override
    if "target_keywords" in profile_data:
        result["target_keywords"] = profile_data["target_keywords"]
    if "generic_anchors" in profile_data:
        result["generic_anchors"] = profile_data["generic_anchors"]
    return result


def set_profile_settings(
    profile: str,
    branded_terms: list[str],
    excluded_auto_terms: list[str] | None = None,
    target_keywords: list[str] | None = None,
    generic_anchors: list[str] | None = None,
) -> None:
    data = _read()
    existing = data.get(profile, {})
    existing["branded_terms"] = _clean_list(branded_terms)
    if excluded_auto_terms is not None:
        existing["excluded_auto_terms"] = _clean_list(excluded_auto_terms)

    # target_keywords: list = store override, None = remove override (use global)
    if target_keywords is not None:
        existing["target_keywords"] = _clean_list(target_keywords)
    else:
        existing.pop("target_keywords", None)

    # generic_anchors: list = store override, None = remove override (use global)
    if generic_anchors is not None:
        existing["generic_anchors"] = _clean_list(generic_anchors)
    else:
        existing.pop("generic_anchors", None)

    data[profile] = existing
    _write(data)


def get_global_settings() -> dict:
    data = _read()
    g = data.get("_global", {})
    return {
        "generic_anchors": g.get("generic_anchors", []),
        "target_keywords": g.get("target_keywords", []),
    }


def set_global_settings(
    generic_anchors: list[str], target_keywords: list[str]
) -> None:
    data = _read()
    data["_global"] = {
        "generic_anchors": _clean_list(generic_anchors),
        "target_keywords": _clean_list(target_keywords),
    }
    _write(data)
