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


def categorise_anchor(
    anchor: Optional[str],
    link_type: Optional[str],
) -> str:
    """Return the category string for a single anchor text."""
    cfg = get_config().get("anchor_categories", {})
    branded_terms: list[str] = cfg.get("branded_terms", [])
    target_keywords: list[str] = cfg.get("target_keywords", [])

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
        if term.lower() in anchor_lower:
            return "branded"

    # generic
    if anchor_lower in GENERIC_ANCHORS:
        return "generic"

    # exact match
    for kw in target_keywords:
        if anchor_lower == kw.lower():
            return "exact_match"

    # partial match
    for kw in target_keywords:
        if kw.lower() in anchor_lower:
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
