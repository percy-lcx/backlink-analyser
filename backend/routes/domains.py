from fastapi import APIRouter, Query
from backend.db import get_conn

router = APIRouter()

SORTABLE_COLUMNS = {
    "link_count",
    "max_dr",
    "total_traffic",
    "referring_domain",
}


@router.get("/api/referring-domains")
def referring_domains(
    profile: str = Query(...),
    sort: str = Query("link_count:desc"),
):
    """Group by referring domain with aggregated metrics."""
    conn = get_conn()

    sort_parts = sort.split(":")
    sort_col = sort_parts[0] if sort_parts[0] in SORTABLE_COLUMNS else "link_count"
    sort_dir = "ASC" if len(sort_parts) > 1 and sort_parts[1].lower() == "asc" else "DESC"

    rows = conn.execute(
        f"""
        SELECT
            referring_domain,
            COUNT(*) AS link_count,
            MAX(domain_rating) AS max_dr,
            SUM(COALESCE(page_traffic, 0)) AS total_traffic,
            MODE(anchor) AS most_common_anchor,
            CASE WHEN MAX(COALESCE(links_in_group, 0)) > 10 THEN true ELSE false END AS is_sitewide
        FROM backlinks
        WHERE profile_label = $1
        GROUP BY referring_domain
        ORDER BY {sort_col} {sort_dir} NULLS LAST
        """,
        [profile],
    ).fetchall()

    cols = [
        "referring_domain",
        "link_count",
        "max_dr",
        "total_traffic",
        "most_common_anchor",
        "is_sitewide",
    ]
    return [dict(zip(cols, row)) for row in rows]
