import re
from typing import Optional
from config import get_config

# Pre-compiled regex patterns, lazily initialised once.
_compiled_page_patterns: dict[str, list[re.Pattern]] | None = None


def _get_compiled_page_patterns() -> dict[str, list[re.Pattern]]:
    global _compiled_page_patterns
    if _compiled_page_patterns is None:
        cfg = get_config().get("page_categories", {})
        _compiled_page_patterns = {
            cat: [re.compile(p) for p in patterns]
            for cat, patterns in cfg.items()
        }
    return _compiled_page_patterns


def categorise_page(target_path: Optional[str]) -> str:
    """Categorise a target_path using config patterns, with fallback heuristics."""
    if not target_path:
        return "other"

    # Try pre-compiled config patterns first
    for category, patterns in _get_compiled_page_patterns().items():
        for pat in patterns:
            if pat.search(target_path):
                return category

    # Fallback heuristics
    if target_path == "/" or target_path.startswith("/index"):
        return "homepage"

    for prefix in ("/blog/", "/education/", "/news/"):
        if prefix in target_path:
            return "content"

    return "money_pages"
