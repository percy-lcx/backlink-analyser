import re
from typing import Optional
from config import get_config


def categorise_page(target_path: Optional[str]) -> str:
    """Categorise a target_path using config patterns, with fallback heuristics."""
    if not target_path:
        return "other"

    cfg = get_config().get("page_categories", {})

    # Try config patterns first
    for category, patterns in cfg.items():
        for pattern in patterns:
            if re.search(pattern, target_path):
                return category

    return "other"
