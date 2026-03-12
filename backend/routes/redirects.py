from __future__ import annotations
from fastapi import APIRouter, Query
from db import get_conn
from analysis.redirects import parse_redirect_chain

router = APIRouter()


@router.get("/api/redirects")
def redirects(profile: str = Query(...)):
    """Find links with redirect chains, parse them, and return analysis."""
    conn = get_conn()

    rows = conn.execute(
        """
        SELECT
            referring_url,
            referring_domain,
            target_url,
            target_path,
            domain_rating,
            redirect_chain_urls,
            redirect_chain_codes,
            anchor
        FROM backlinks
        WHERE profile_label = $1
          AND redirect_chain_urls IS NOT NULL
          AND redirect_chain_urls != ''
        ORDER BY domain_rating DESC NULLS LAST
        """,
        [profile],
    ).fetchall()

    cols = [
        "referring_url",
        "referring_domain",
        "target_url",
        "target_path",
        "domain_rating",
        "redirect_chain_urls",
        "redirect_chain_codes",
        "anchor",
    ]

    items = []
    chain_length_groups: dict[int, int] = {}

    for row in rows:
        item = dict(zip(cols, row))
        chain_info = parse_redirect_chain(
            item.get("redirect_chain_urls"),
            item.get("redirect_chain_codes"),
        )
        item["chain_length"] = chain_info["chain_length"]
        item["has_302"] = chain_info["has_302"]
        item["status_codes"] = chain_info["status_codes"]
        item["flagged"] = chain_info["chain_length"] >= 2 or chain_info["has_302"]
        items.append(item)

        cl = chain_info["chain_length"]
        chain_length_groups[cl] = chain_length_groups.get(cl, 0) + 1

    # Sort worst offenders: flagged first, then by DR desc
    worst_offenders = sorted(
        [i for i in items if i["flagged"]],
        key=lambda x: -(x.get("domain_rating") or 0),
    )

    return {
        "total_with_redirects": len(items),
        "chain_length_distribution": chain_length_groups,
        "worst_offenders": worst_offenders,
        "all": items,
    }
