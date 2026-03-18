from __future__ import annotations

import re
import threading
from typing import Optional

from config import get_config
import anchor_settings


_cache: dict[str, tuple[list[str], list[str]]] = {}
_cache_lock = threading.Lock()


def resolve_profile_terms(
    profile: str,
    conn,  # duckdb.DuckDBPyConnection
) -> tuple[list[str], list[str]]:
    """Return (branded_terms, target_keywords) for a profile.

    Resolution:
    1. Auto-detect branded terms from target_domain in the DB
    2. Merge with config overrides from profiles.<profile>
    3. Fall back to global anchor_categories if no profile config exists
    """
    if profile in _cache:
        return _cache[profile]

    with _cache_lock:
        if profile in _cache:
            return _cache[profile]

        auto_branded = _auto_detect_branded(profile, conn)

        # Settings file takes precedence over config.yaml
        settings = anchor_settings.get_profile_settings(profile)
        config_branded = settings["branded_terms"]
        config_keywords = settings["target_keywords"]

        # Fall back to config.yaml if settings file has nothing
        if not config_branded:
            cfg = get_config()
            profile_cfg = cfg.get("profiles", {}).get(profile, {})
            config_branded = [t.lower() for t in profile_cfg.get("branded_terms", [])]
        if not config_keywords:
            cfg = get_config()
            profile_cfg = cfg.get("profiles", {}).get(profile, {})
            config_keywords = [kw.lower() for kw in profile_cfg.get("target_keywords", [])]

        # Fallback to global config when no profile-specific config exists
        if not config_branded and not auto_branded:
            global_cfg = get_config().get("anchor_categories", {})
            config_branded = [t.lower() for t in global_cfg.get("branded_terms", [])]
        if not config_keywords:
            global_cfg = get_config().get("anchor_categories", {})
            config_keywords = [kw.lower() for kw in global_cfg.get("target_keywords", [])]

        branded = _merge_unique(auto_branded, config_branded)
        keywords = config_keywords

        _cache[profile] = (branded, keywords)
        return branded, keywords


def invalidate_cache(profile: Optional[str] = None) -> None:
    """Clear cached terms. Call after config reload or re-ingestion."""
    with _cache_lock:
        if profile:
            _cache.pop(profile, None)
        else:
            _cache.clear()


def get_auto_branded_terms(profile: str, conn) -> list[str]:
    """Public wrapper for auto-detecting branded terms from target_domain."""
    return _auto_detect_branded(profile, conn)


def _auto_detect_branded(profile: str, conn) -> list[str]:
    """Query target_domain for this profile and derive branded term variants."""
    row = conn.execute(
        "SELECT DISTINCT target_domain FROM backlinks WHERE profile_label = $1 LIMIT 1",
        [profile],
    ).fetchone()

    if not row or not row[0]:
        return []

    domain = row[0].lower().strip()
    return _domain_to_brand_terms(domain)


def _domain_to_brand_terms(domain: str) -> list[str]:
    """Derive branded term variants from a domain.

    "avatrade.com" → ["avatrade", "avatrade.com", "www.avatrade.com"]
    """
    bare = domain.removeprefix("www.")
    name = bare.split(".")[0]

    terms = [name, bare]
    if not domain.startswith("www."):
        terms.append(f"www.{bare}")

    # Insert spaces before digit boundaries (e.g. "site123" → "site 123")
    spaced = re.sub(r"(\d+)", r" \1", name).strip()
    if spaced != name:
        terms.append(spaced)

    return list(dict.fromkeys(terms))  # deduplicate, preserve order


def _merge_unique(a: list[str], b: list[str]) -> list[str]:
    """Merge two lists, deduplicating while preserving order (a first)."""
    seen: set[str] = set()
    result: list[str] = []
    for item in a + b:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result
