from __future__ import annotations
import re
from typing import Optional
from config import get_config

_URL_PATTERN = re.compile(
    r"^(https?://)?(www\.)?[\w\-]+\.[\w\-]+(\.[\w\-]+)*(\/\S*)?$", re.IGNORECASE
)

# Pre-lowercased config terms, lazily initialised once.
_lowered_branded: list[str] | None = None
_lowered_keywords: list[str] | None = None
_lowered_generic: list[str] | None = None


def _get_lowered_terms() -> tuple[list[str], list[str], list[str]]:
    global _lowered_branded, _lowered_keywords, _lowered_generic
    if _lowered_branded is None:
        cfg = get_config().get("anchor_categories", {})
        _lowered_branded = [t.lower() for t in cfg.get("branded_terms", [])]
        _lowered_keywords = [kw.lower() for kw in cfg.get("target_keywords", [])]
        _lowered_generic = [g.lower() for g in cfg.get("generic_anchors", [])]
    return _lowered_branded, _lowered_keywords, _lowered_generic  # type: ignore[return-value]


def categorise_anchor(
    anchor: Optional[str],
    link_type: Optional[str],
) -> str:
    """Return the category string for a single anchor text."""
    branded_terms, target_keywords, generic_anchors = _get_lowered_terms()

    # empty / no text
    if not anchor or not anchor.strip():
        return "empty"

    anchor_lower = anchor.strip().lower()

    # image links
    if link_type and link_type.lower() == "image":
        return "image"

    # pre-compute brand and keyword presence (reused below)
    has_brand = any(term in anchor_lower for term in branded_terms)
    has_keyword = any(kw in anchor_lower for kw in target_keywords)

    # brand + keyword combo (most specific — check before individual)
    if has_brand and has_keyword:
        return "brand_keyword"

    # branded
    if has_brand:
        return "branded"

    # exact keyword match
    for kw in target_keywords:
        if anchor_lower == kw:
            return "exact_match"

    # partial keyword match
    if has_keyword:
        return "partial_match"

    # naked URL (after branded/keyword checks so branded URLs stay branded)
    if _URL_PATTERN.match(anchor_lower):
        return "naked_url"

    # generic — substring match (not exact-only)
    if any(term in anchor_lower for term in generic_anchors):
        return "generic"

    return "other"


def categorise_anchors(rows: list[dict]) -> list[dict]:
    """Add a 'category' key to each row dict based on anchor + link_type."""
    for row in rows:
        row["category"] = categorise_anchor(
            row.get("anchor"), row.get("link_type")
        )
    return rows


def summarise_categories(rows: list[dict]) -> dict:
    """Return {category: {count, percentage}} from already-categorised rows."""
    total = len(rows) if rows else 1
    counts: dict[str, int] = {}
    for row in rows:
        cat = row.get("category", "other")
        counts[cat] = counts.get(cat, 0) + 1
    return {
        cat: {"count": c, "percentage": round(c / total * 100, 2)}
        for cat, c in counts.items()
    }


def summarise_categories_weighted(items: list[dict]) -> dict:
    """Like summarise_categories but uses pre-aggregated counts — O(M) not O(N)."""
    total = sum(r["count"] for r in items) or 1
    counts: dict[str, int] = {}
    for r in items:
        cat = r.get("category", "other")
        counts[cat] = counts.get(cat, 0) + r["count"]
    return {
        cat: {"count": c, "percentage": round(c / total * 100, 2)}
        for cat, c in counts.items()
    }
