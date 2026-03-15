from typing import Optional

from fastapi import APIRouter, Query
from db import get_conn
from routes._filters import apply_text_filter

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
    domain_search: Optional[str] = Query(None),
    domain_mode: Optional[str] = Query(None),
    domain_exclude: Optional[bool] = Query(None),
    dr_min: Optional[float] = Query(None),
    dr_max: Optional[float] = Query(None),
    traffic_min: Optional[float] = Query(None),
    traffic_max: Optional[float] = Query(None),
    links_min: Optional[int] = Query(None),
    links_max: Optional[int] = Query(None),
    is_sitewide: Optional[bool] = Query(None),
):
    """Group by referring domain with aggregated metrics."""
    conn = get_conn()

    sort_parts = sort.split(":")
    sort_col = sort_parts[0] if sort_parts[0] in SORTABLE_COLUMNS else "link_count"
    sort_dir = "ASC" if len(sort_parts) > 1 and sort_parts[1].lower() == "asc" else "DESC"

    # WHERE conditions (pre-aggregation)
    conditions = ["profile_label = $1"]
    params: list = [profile]
    idx = 2

    if domain_search:
        idx = apply_text_filter(
            conditions, params, idx, "referring_domain", domain_search,
            mode=domain_mode or "contains",
            exclude=bool(domain_exclude),
        )

    where = " AND ".join(conditions)

    # HAVING conditions (post-aggregation)
    having_parts: list[str] = []

    if dr_min is not None:
        having_parts.append(f"MAX(domain_rating) >= ${idx}")
        params.append(dr_min)
        idx += 1
    if dr_max is not None:
        having_parts.append(f"MAX(domain_rating) <= ${idx}")
        params.append(dr_max)
        idx += 1
    if traffic_min is not None:
        having_parts.append(f"SUM(COALESCE(page_traffic, 0)) >= ${idx}")
        params.append(traffic_min)
        idx += 1
    if traffic_max is not None:
        having_parts.append(f"SUM(COALESCE(page_traffic, 0)) <= ${idx}")
        params.append(traffic_max)
        idx += 1
    if links_min is not None:
        having_parts.append(f"COUNT(*) >= ${idx}")
        params.append(links_min)
        idx += 1
    if links_max is not None:
        having_parts.append(f"COUNT(*) <= ${idx}")
        params.append(links_max)
        idx += 1
    if is_sitewide is not None:
        if is_sitewide:
            having_parts.append("MAX(COALESCE(links_in_group, 0)) > 10")
        else:
            having_parts.append("MAX(COALESCE(links_in_group, 0)) <= 10")

    having = f"HAVING {' AND '.join(having_parts)}" if having_parts else ""

    rows = conn.execute(
        f"""
        SELECT
            referring_domain,
            COUNT(*) AS link_count,
            MAX(domain_rating) AS max_dr,
            SUM(COALESCE(page_traffic, 0)) AS total_traffic,
            CASE WHEN MAX(COALESCE(links_in_group, 0)) > 10 THEN true ELSE false END AS is_sitewide
        FROM backlinks
        WHERE {where}
        GROUP BY referring_domain
        {having}
        ORDER BY {sort_col} {sort_dir} NULLS LAST
        """,
        params,
    ).fetchall()

    cols = [
        "referring_domain",
        "link_count",
        "max_dr",
        "total_traffic",
        "is_sitewide",
    ]
    return [dict(zip(cols, row)) for row in rows]
