from fastapi import APIRouter, Query
from db import get_conn

router = APIRouter()


@router.get("/api/compare")
def compare(profiles: str = Query(...)):
    """Parallel summary for multiple profiles (comma-separated)."""
    conn = get_conn()
    profile_list = [p.strip() for p in profiles.split(",") if p.strip()]

    if not profile_list:
        return []

    results = []
    for label in profile_list:
        row = conn.execute(
            """
            SELECT
                COUNT(*) AS total_links,
                COUNT(DISTINCT referring_domain) AS referring_domains,
                AVG(domain_rating) AS avg_dr,
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
                COUNT(DISTINCT anchor) AS anchor_diversity
            FROM backlinks
            WHERE profile_label = $1
            """,
            [label],
        ).fetchone()

        cols = [
            "total_links",
            "referring_domains",
            "avg_dr",
            "dofollow_ratio",
            "spam_ratio",
            "anchor_diversity",
        ]
        summary = dict(zip(cols, row)) if row else {}
        summary["profile_label"] = label
        results.append(summary)

    return results
