from __future__ import annotations
import re
from typing import Optional
from config import get_config

GENERIC_ANCHORS = {
    "click here",
    "read more",
    "visit",
    "website",
    "overview",
    "learn more",
    "here",
    "this",
    "link",
    "source",
}

_URL_PATTERN = re.compile(
    r"^(https?://)?(www\.)?[\w\-]+\.[\w\-]+(\.[\w\-]+)*(\/\S*)?$", re.IGNORECASE
)

# Pre-lowercased config terms, lazily initialised once.
_lowered_branded: list[str] | None = None
_lowered_keywords: list[str] | None = None


def _get_lowered_terms() -> tuple[list[str], list[str]]:
    global _lowered_branded, _lowered_keywords
    if _lowered_branded is None:
        cfg = get_config().get("anchor_categories", {})
        _lowered_branded = [t.lower() for t in cfg.get("branded_terms", [])]
        _lowered_keywords = [kw.lower() for kw in cfg.get("target_keywords", [])]
    return _lowered_branded, _lowered_keywords  # type: ignore[return-value]


def categorise_anchor(
    anchor: Optional[str],
    link_type: Optional[str],
) -> str:
    """Return the category string for a single anchor text."""
    branded_terms, target_keywords = _get_lowered_terms()

    if not anchor:
        anchor = ""
    anchor_lower = anchor.strip().lower()

    # image links
    if link_type and link_type.lower() == "image":
        return "image"

    # naked URL
    if anchor_lower and _URL_PATTERN.match(anchor_lower):
        return "naked_url"

    # branded
    for term in branded_terms:
        if term in anchor_lower:
            return "branded"

    # generic
    if anchor_lower in GENERIC_ANCHORS:
        return "generic"

    # Single pass: check both exact and partial match in one loop — O(K)
    found_partial = False
    for kw in target_keywords:
        if anchor_lower == kw:
            return "exact_match"
        if not found_partial and kw in anchor_lower:
            found_partial = True
    if found_partial:
        return "partial_match"

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
