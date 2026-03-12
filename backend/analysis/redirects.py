from __future__ import annotations
from typing import Optional


def parse_redirect_chain(
    redirect_chain_urls: Optional[str],
    redirect_chain_codes: Optional[str],
) -> dict:
    """Parse redirect chain fields and return structured info.

    redirect_chain_urls may be pipe-separated or ' -> ' separated.
    redirect_chain_codes may be pipe-separated or ' -> ' separated.
    """
    if not redirect_chain_urls:
        return {
            "chain_length": 0,
            "has_302": False,
            "status_codes": [],
            "urls": [],
        }

    # Determine separator
    if " -> " in redirect_chain_urls:
        urls = [u.strip() for u in redirect_chain_urls.split(" -> ") if u.strip()]
    else:
        urls = [u.strip() for u in redirect_chain_urls.split("|") if u.strip()]

    codes: list[int] = []
    if redirect_chain_codes:
        raw = redirect_chain_codes
        if " -> " in raw:
            parts = [c.strip() for c in raw.split(" -> ") if c.strip()]
        else:
            parts = [c.strip() for c in raw.split("|") if c.strip()]
        for p in parts:
            try:
                codes.append(int(p))
            except ValueError:
                pass

    has_302 = 302 in codes or 307 in codes

    return {
        "chain_length": len(urls),
        "has_302": has_302,
        "status_codes": codes,
        "urls": urls,
    }
