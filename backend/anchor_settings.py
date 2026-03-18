"""File-based storage for per-profile anchor categorization settings."""

import json
import os

_STORE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "store"
)
_SETTINGS_PATH = os.path.join(_STORE_DIR, "profile-settings.json")


def _read() -> dict:
    if not os.path.exists(_SETTINGS_PATH):
        return {}
    with open(_SETTINGS_PATH, "r") as f:
        data = json.load(f)
    return data if isinstance(data, dict) else {}


def _write(data: dict) -> None:
    os.makedirs(_STORE_DIR, exist_ok=True)
    with open(_SETTINGS_PATH, "w") as f:
        json.dump(data, f, indent=2)


def _clean_list(items: list[str]) -> list[str]:
    """Lowercase, strip, deduplicate, and sort a list of strings."""
    return sorted(set(s.strip().lower() for s in items if s.strip()))


def _migrate_target_keywords(data: dict) -> bool:
    """Migrate target_keywords from per-profile to _global if needed."""
    migrated = False
    global_kw: set[str] = set(data.get("_global", {}).get("target_keywords", []))
    for key, val in list(data.items()):
        if key == "_global" or not isinstance(val, dict):
            continue
        profile_kw = val.pop("target_keywords", None)
        if profile_kw:
            global_kw.update(profile_kw)
            migrated = True
    if migrated:
        data.setdefault("_global", {})["target_keywords"] = sorted(global_kw)
    return migrated


def get_all_settings() -> dict:
    return _read()


def get_profile_settings(profile: str) -> dict:
    data = _read()
    # Migrate legacy target_keywords if present
    if any(
        isinstance(v, dict) and "target_keywords" in v
        for k, v in data.items()
        if k != "_global"
    ):
        if _migrate_target_keywords(data):
            _write(data)
    profile_data = data.get(profile, {})
    return {
        "branded_terms": profile_data.get("branded_terms", []),
    }


def set_profile_settings(
    profile: str, branded_terms: list[str]
) -> None:
    data = _read()
    existing = data.get(profile, {})
    existing["branded_terms"] = _clean_list(branded_terms)
    # Remove legacy target_keywords from profile level
    existing.pop("target_keywords", None)
    data[profile] = existing
    _write(data)


def get_global_settings() -> dict:
    data = _read()
    # Migrate legacy target_keywords if present
    if any(
        isinstance(v, dict) and "target_keywords" in v
        for k, v in data.items()
        if k != "_global"
    ):
        if _migrate_target_keywords(data):
            _write(data)
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
