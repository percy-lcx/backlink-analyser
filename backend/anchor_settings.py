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


def get_all_settings() -> dict:
    return _read()


def get_profile_settings(profile: str) -> dict:
    data = _read().get(profile, {})
    return {
        "branded_terms": data.get("branded_terms", []),
        "target_keywords": data.get("target_keywords", []),
    }


def set_profile_settings(
    profile: str, branded_terms: list[str], target_keywords: list[str]
) -> None:
    data = _read()
    data[profile] = {
        "branded_terms": _clean_list(branded_terms),
        "target_keywords": _clean_list(target_keywords),
    }
    _write(data)


def get_global_settings() -> dict:
    data = _read().get("_global", {})
    return {"generic_anchors": data.get("generic_anchors", [])}


def set_global_settings(generic_anchors: list[str]) -> None:
    data = _read()
    data["_global"] = {"generic_anchors": _clean_list(generic_anchors)}
    _write(data)
