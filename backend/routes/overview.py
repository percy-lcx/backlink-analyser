from typing import Optional
from fastapi import APIRouter, Query
from db import get_conn

router = APIRouter()


@router.get("/api/profiles")
def list_profiles():
    """List all profile labels with count, unique referring domains, avg DR."""
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT
            profile_label,
            COUNT(*) AS total_links,
            COUNT(DISTINCT referring_domain) AS unique_referring_domains,
            ROUND(AVG(domain_rating), 1) AS avg_dr
        FROM backlinks
        GROUP BY profile_label
        ORDER BY profile_label
        """
    ).fetchall()
    cols = ["profile_label", "total_links", "unique_referring_domains", "avg_dr"]
    return [dict(zip(cols, row)) for row in rows]


@router.get("/api/overview")
def overview(
    profile: str = Query(...),
    target_path: Optional[str] = Query(None),
):
    """Return summary stats for a single profile."""
    conn = get_conn()

    where = "profile_label = $1"
    params: list[str] = [profile]
    if target_path:
        where += " AND target_path = $2"
        params.append(target_path)

    row = conn.execute(
        f"""
        SELECT
            COUNT(*) AS total_backlinks,
            COUNT(DISTINCT referring_domain) AS unique_referring_domains,
            COUNT(*) FILTER (
                WHERE COALESCE(is_nofollow, false) = false
                  AND COALESCE(is_ugc, false) = false
                  AND COALESCE(is_sponsored, false) = false
            ) AS dofollow_count,
            COUNT(*) FILTER (WHERE is_nofollow = true) AS nofollow_count,
            COUNT(*) FILTER (WHERE is_ugc = true) AS ugc_count,
            COUNT(*) FILTER (WHERE is_sponsored = true) AS sponsored_count,
            COUNT(*) FILTER (WHERE link_type = 'image') AS image_link_count,
            COUNT(*) FILTER (WHERE link_type != 'image' OR link_type IS NULL) AS text_link_count,
            ROUND(AVG(domain_rating), 1) AS avg_dr,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY domain_rating), 1) AS median_dr,
            CASE WHEN COUNT(*) > 0
                THEN COUNT(*) FILTER (WHERE is_spam = true)::FLOAT / COUNT(*)
                ELSE 0 END AS spam_ratio,
            SUM(COALESCE(page_traffic, 0)) AS total_page_traffic,
            MAX(first_seen) AS newest_backlink_date
        FROM backlinks
        WHERE {where}
        """,
        params,
    ).fetchone()

    cols = [
        "total_backlinks",
        "unique_referring_domains",
        "dofollow_count",
        "nofollow_count",
        "ugc_count",
        "sponsored_count",
        "image_link_count",
        "text_link_count",
        "avg_dr",
        "median_dr",
        "spam_ratio",
        "total_page_traffic",
        "newest_backlink_date",
    ]
    return dict(zip(cols, row)) if row else {}
