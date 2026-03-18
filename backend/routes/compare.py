from typing import Optional

from fastapi import APIRouter, Query
from db import get_conn

router = APIRouter()


@router.get("/api/compare")
def compare(
    profiles: str = Query(...),
    target_paths: Optional[str] = Query(None),
):
    """Parallel summary for multiple profiles (comma-separated).

    Optional ``target_paths`` (comma-separated, positionally matching
    ``profiles``) narrows each profile's stats to a specific target URL path.
    """
    conn = get_conn()
    profile_list = [p.strip() for p in profiles.split(",") if p.strip()]
    tp_list: list[str] = []
    if target_paths:
        tp_list = [p.strip() for p in target_paths.split(",")]

    if not profile_list:
        return []

    # Check if any profile has a per-profile target_path filter
    has_per_profile_paths = any(
        tp_list[i] if i < len(tp_list) else None for i in range(len(profile_list))
    )

    cols = [
        "profile_label",
        "total_links",
        "referring_domains",
        "avg_dr",
        "median_dr",
        "dofollow_ratio",
        "spam_ratio",
        "anchor_diversity",
        "links_per_domain",
        "sitewide_ratio",
        "image_link_ratio",
        "total_page_traffic",
    ]

    agg_sql = """
        SELECT
            profile_label,
            COUNT(*) AS total_links,
            COUNT(DISTINCT referring_domain) AS referring_domains,
            ROUND(AVG(domain_rating), 1) AS avg_dr,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY domain_rating), 1) AS median_dr,
            CASE WHEN COUNT(*) > 0
                THEN COUNT(*) FILTER (
                    WHERE COALESCE(is_nofollow, false) = false
                      AND COALESCE(is_ugc, false) = false
                      AND COALESCE(is_sponsored, false) = false
                )::FLOAT / COUNT(*)
                ELSE 0 END AS dofollow_ratio,
            CASE WHEN COUNT(*) > 0
                THEN COUNT(*) FILTER (WHERE is_spam = true)::FLOAT / COUNT(*)
                ELSE 0 END AS spam_ratio,
            COUNT(DISTINCT anchor) AS anchor_diversity,
            CASE WHEN COUNT(DISTINCT referring_domain) > 0
                THEN COUNT(*)::FLOAT / COUNT(DISTINCT referring_domain)
                ELSE 0 END AS links_per_domain,
            CASE WHEN COUNT(*) > 0
                THEN COUNT(*) FILTER (WHERE links_in_group > 10)::FLOAT / COUNT(*)
                ELSE 0 END AS sitewide_ratio,
            CASE WHEN COUNT(*) > 0
                THEN COUNT(*) FILTER (WHERE link_type = 'image')::FLOAT / COUNT(*)
                ELSE 0 END AS image_link_ratio,
            SUM(COALESCE(page_traffic, 0)) AS total_page_traffic
        FROM backlinks
    """

    if not has_per_profile_paths:
        # Single query with GROUP BY — O(N_total) instead of O(P × N)
        placeholders = ", ".join(f"${i + 1}" for i in range(len(profile_list)))
        rows = conn.execute(
            f"{agg_sql} WHERE profile_label IN ({placeholders}) GROUP BY profile_label",
            profile_list,
        ).fetchall()
        row_map = {r[0]: dict(zip(cols, r)) for r in rows}
        return [row_map.get(label, {"profile_label": label}) for label in profile_list]

    # Per-profile target_path filters differ — use UNION ALL (still 1 round-trip)
    parts: list[str] = []
    params: list[str] = []
    idx = 1
    for i, label in enumerate(profile_list):
        tp = tp_list[i] if i < len(tp_list) and tp_list[i] else None
        where = f"WHERE profile_label = ${idx}"
        params.append(label)
        idx += 1
        if tp:
            where += f" AND target_path = ${idx}"
            params.append(tp)
            idx += 1
        parts.append(f"{agg_sql} {where} GROUP BY profile_label")

    rows = conn.execute(" UNION ALL ".join(parts), params).fetchall()
    row_map = {r[0]: dict(zip(cols, r)) for r in rows}
    return [row_map.get(label, {"profile_label": label}) for label in profile_list]
