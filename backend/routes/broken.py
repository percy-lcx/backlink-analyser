from fastapi import APIRouter, Query
from typing import Optional
from db import get_conn
from routes._filters import apply_text_filter

router = APIRouter()

SORTABLE_COLUMNS = {
    "domain_rating",
    "url_rating",
    "page_traffic",
    "domain_traffic",
    "first_seen",
    "last_seen",
    "referring_domain",
    "anchor",
    "target_path",
    "http_code",
}


@router.get("/api/broken-links")
def broken_links(
    profile: str = Query(...),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=1000),
    sort: str = Query("domain_rating:desc"),
    domain_search: Optional[str] = Query(None),
    domain_mode: Optional[str] = Query(None),
    domain_exclude: Optional[bool] = Query(None),
    http_code: Optional[str] = Query(None),
    dr_min: Optional[float] = Query(None),
    dr_max: Optional[float] = Query(None),
):
    """Broken links report: summary, status code distribution, and paginated items."""
    conn = get_conn()

    base_where = "profile_label = $1 AND http_code >= 400"

    # Summary (always full broken set, no sub-filters)
    summary_row = conn.execute(
        f"""
        SELECT
            COUNT(*) AS total_broken,
            SUM(CASE WHEN http_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS count_4xx,
            SUM(CASE WHEN http_code >= 500 THEN 1 ELSE 0 END) AS count_5xx,
            COUNT(DISTINCT referring_domain) AS unique_domains_affected
        FROM backlinks
        WHERE {base_where}
        """,
        [profile],
    ).fetchone()

    summary = {
        "total_broken": summary_row[0],
        "count_4xx": summary_row[1],
        "count_5xx": summary_row[2],
        "unique_domains_affected": summary_row[3],
    }

    # Distribution (also full broken set)
    dist_rows = conn.execute(
        f"""
        SELECT http_code, COUNT(*) AS count
        FROM backlinks
        WHERE {base_where}
        GROUP BY http_code
        ORDER BY http_code
        """,
        [profile],
    ).fetchall()

    distribution = [{"http_code": row[0], "count": row[1]} for row in dist_rows]

    # Filtered items query
    conditions = ["profile_label = $1", "http_code >= 400"]
    params: list = [profile]
    idx = 2

    if http_code is not None:
        codes = [int(c) for c in http_code.split(",") if c.strip().isdigit()]
        if codes:
            placeholders = ", ".join(f"${idx + i}" for i in range(len(codes)))
            conditions.append(f"http_code IN ({placeholders})")
            params.extend(codes)
            idx += len(codes)

    if domain_search is not None:
        idx = apply_text_filter(
            conditions, params, idx, "referring_domain", domain_search,
            mode=domain_mode or "contains",
            exclude=bool(domain_exclude),
        )

    if dr_min is not None:
        conditions.append(f"domain_rating >= ${idx}")
        params.append(dr_min)
        idx += 1

    if dr_max is not None:
        conditions.append(f"domain_rating <= ${idx}")
        params.append(dr_max)
        idx += 1

    where = " AND ".join(conditions)

    # Parse sort
    sort_parts = sort.split(":")
    sort_col = sort_parts[0] if sort_parts[0] in SORTABLE_COLUMNS else "domain_rating"
    sort_dir = "ASC" if len(sort_parts) > 1 and sort_parts[1].lower() == "asc" else "DESC"
    order_clause = f"{sort_col} {sort_dir} NULLS LAST"

    # Count
    total = conn.execute(
        f"SELECT COUNT(*) FROM backlinks WHERE {where}", params
    ).fetchone()[0]

    offset = (page - 1) * per_page
    rows = conn.execute(
        f"""
        SELECT
            referring_domain, referring_url, target_url, target_path,
            anchor, http_code, link_type,
            domain_rating, url_rating, page_traffic, domain_traffic,
            first_seen, last_seen,
            is_nofollow, is_ugc, is_sponsored, is_spam
        FROM backlinks
        WHERE {where}
        ORDER BY {order_clause}
        LIMIT {per_page} OFFSET {offset}
        """,
        params,
    ).fetchall()

    cols = [
        "referring_domain", "referring_url", "target_url", "target_path",
        "anchor", "http_code", "link_type",
        "domain_rating", "url_rating", "page_traffic", "domain_traffic",
        "first_seen", "last_seen",
        "is_nofollow", "is_ugc", "is_sponsored", "is_spam",
    ]
    items = [dict(zip(cols, row)) for row in rows]

    return {
        "summary": summary,
        "distribution": distribution,
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
    }
