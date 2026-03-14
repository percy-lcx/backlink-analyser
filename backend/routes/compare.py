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

    results = []
    for idx, label in enumerate(profile_list):
        tp = tp_list[idx] if idx < len(tp_list) and tp_list[idx] else None

        where = "WHERE profile_label = $1"
        params: list[str] = [label]
        if tp:
            where += " AND target_path = $2"
            params.append(tp)

        row = conn.execute(
            f"""
            SELECT
                COUNT(*) AS total_links,
                COUNT(DISTINCT referring_domain) AS referring_domains,
                AVG(domain_rating) AS avg_dr,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY domain_rating) AS median_dr,
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
                    ELSE 0 END AS image_link_ratio
            FROM backlinks
            {where}
            """,
            params,
        ).fetchone()

        cols = [
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
        ]
        summary = dict(zip(cols, row)) if row else {}
        summary["profile_label"] = label
        results.append(summary)

    return results
