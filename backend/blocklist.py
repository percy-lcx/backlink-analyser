"""File-based blocklist storage for flagging unhelpful domains."""

import json
import os

_STORE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "store"
)
_BLOCKLIST_PATH = os.path.join(_STORE_DIR, "blocklist.json")


def get_blocklist() -> list[str]:
    """Read the domain blocklist from disk."""
    if not os.path.exists(_BLOCKLIST_PATH):
        return []
    with open(_BLOCKLIST_PATH, "r") as f:
        data = json.load(f)
    return data if isinstance(data, list) else []


def set_blocklist(domains: list[str]) -> None:
    """Write the domain blocklist to disk."""
    os.makedirs(_STORE_DIR, exist_ok=True)
    # Deduplicate and lowercase for consistent matching
    unique = sorted(set(d.strip().lower() for d in domains if d.strip()))
    with open(_BLOCKLIST_PATH, "w") as f:
        json.dump(unique, f, indent=2)
