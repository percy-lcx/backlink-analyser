from fastapi import APIRouter, Query
from db import get_conn

router = APIRouter()


@router.get("/api/sitewide")
def sitewide(
    profile: str = Query(...),
    threshold: int = Query(10),
):
    """Referring domains where max links_in_group > threshold."""
    conn = get_conn()

    sitewide_rows = conn.execute(
        f"""
        SELECT
            referring_domain,
            COUNT(*) AS link_count,
            MAX(domain_rating) AS dr,
            MODE(anchor) AS anchor_pattern,
            MAX(COALESCE(links_in_group, 0)) AS max_links_in_group
        FROM backlinks
        WHERE profile_label = $1
        GROUP BY referring_domain
        HAVING MAX(COALESCE(links_in_group, 0)) > {threshold}
        ORDER BY link_count DESC
        """,
        [profile],
    ).fetchall()

    cols = ["referring_domain", "link_count", "dr", "anchor_pattern", "max_links_in_group"]
    sitewide_domains = [dict(zip(cols, row)) for row in sitewide_rows]

    # Aggregate stats: with vs without sitewide (CTE-based)
    stats = conn.execute(
        f"""
        WITH domain_sitewide AS (
            SELECT
                referring_domain,
                CASE WHEN MAX(COALESCE(links_in_group, 0)) > {threshold}
                    THEN true ELSE false END AS is_sitewide
            FROM backlinks
            WHERE profile_label = $1
            GROUP BY referring_domain
        )
        SELECT
            ds.is_sitewide,
            COUNT(*) AS link_count,
            COUNT(DISTINCT b.referring_domain) AS unique_domains,
            AVG(b.domain_rating) AS avg_dr
        FROM backlinks b
        JOIN domain_sitewide ds ON b.referring_domain = ds.referring_domain
        WHERE b.profile_label = $1
        GROUP BY ds.is_sitewide
        """,
        [profile],
    ).fetchall()

    aggregate = {}
    for row in stats:
        key = "sitewide" if row[0] else "non_sitewide"
        aggregate[key] = {
            "link_count": row[1],
            "unique_domains": row[2],
            "avg_dr": row[3],
        }

    return {
        "sitewide_domains": sitewide_domains,
        "aggregate": aggregate,
    }
