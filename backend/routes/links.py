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
    "link_type",
    "http_code",
    "is_nofollow",
    "is_sponsored",
    "is_spam",
}


@router.get("/api/links")
def list_links(
    profile: str = Query(...),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=1000),
    sort: str = Query("domain_rating:desc"),
    is_nofollow: Optional[bool] = Query(None),
    is_sponsored: Optional[bool] = Query(None),
    is_spam: Optional[bool] = Query(None),
    http_code: Optional[int] = Query(None),
    link_type: Optional[str] = Query(None),
    dr_min: Optional[float] = Query(None),
    dr_max: Optional[float] = Query(None),
    anchor_search: Optional[str] = Query(None),
    anchor_exclude: Optional[bool] = Query(None),
    anchor_mode: Optional[str] = Query(None),
    traffic_min: Optional[float] = Query(None),
    traffic_max: Optional[float] = Query(None),
    first_seen_from: Optional[str] = Query(None),
    first_seen_to: Optional[str] = Query(None),
    domain_search: Optional[str] = Query(None),
    domain_exclude: Optional[bool] = Query(None),
    domain_mode: Optional[str] = Query(None),
    url_search: Optional[str] = Query(None),
    url_exclude: Optional[bool] = Query(None),
    url_mode: Optional[str] = Query(None),
    target_path_search: Optional[str] = Query(None),
    target_path_exact: Optional[bool] = Query(None),
    target_path_exclude: Optional[bool] = Query(None),
    target_path_mode: Optional[str] = Query(None),
):
    """Paginated backlink table with filters."""
    conn = get_conn()

    conditions = ["profile_label = $1"]
    params: list = [profile]
    idx = 2  # next parameter index

    if is_nofollow is not None:
        conditions.append(f"is_nofollow = ${idx}")
        params.append(is_nofollow)
        idx += 1

    if is_sponsored is not None:
        conditions.append(f"is_sponsored = ${idx}")
        params.append(is_sponsored)
        idx += 1

    if http_code is not None:
        conditions.append(f"http_code = ${idx}")
        params.append(http_code)
        idx += 1

    if is_spam is not None:
        conditions.append(f"is_spam = ${idx}")
        params.append(is_spam)
        idx += 1

    if link_type is not None:
        conditions.append(f"link_type = ${idx}")
        params.append(link_type)
        idx += 1

    if dr_min is not None:
        conditions.append(f"domain_rating >= ${idx}")
        params.append(dr_min)
        idx += 1

    if dr_max is not None:
        conditions.append(f"domain_rating <= ${idx}")
        params.append(dr_max)
        idx += 1

    if anchor_search is not None:
        idx = apply_text_filter(
            conditions, params, idx, "anchor", anchor_search,
            mode=anchor_mode or "contains",
            exclude=bool(anchor_exclude),
        )

    if traffic_min is not None:
        conditions.append(f"page_traffic >= ${idx}")
        params.append(traffic_min)
        idx += 1

    if traffic_max is not None:
        conditions.append(f"page_traffic <= ${idx}")
        params.append(traffic_max)
        idx += 1

    if first_seen_from is not None:
        conditions.append(f"first_seen >= ${idx}")
        params.append(first_seen_from)
        idx += 1

    if first_seen_to is not None:
        conditions.append(f"first_seen <= ${idx}")
        params.append(first_seen_to)
        idx += 1

    if domain_search is not None:
        idx = apply_text_filter(
            conditions, params, idx, "referring_domain", domain_search,
            mode=domain_mode or "contains",
            exclude=bool(domain_exclude),
        )

    if url_search is not None:
        idx = apply_text_filter(
            conditions, params, idx, "referring_url", url_search,
            mode=url_mode or "contains",
            exclude=bool(url_exclude),
        )

    if target_path_search is not None:
        # Backward compat: target_path_exact=true → mode="exact"
        tp_mode = target_path_mode or ("exact" if target_path_exact else "contains")
        idx = apply_text_filter(
            conditions, params, idx, "target_path", target_path_search,
            mode=tp_mode,
            exclude=bool(target_path_exclude),
        )

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
        SELECT *
        FROM backlinks
        WHERE {where}
        ORDER BY {order_clause}
        LIMIT {per_page} OFFSET {offset}
        """,
        params,
    ).fetchall()

    cols = [d[0] for d in conn.description] if conn.description else []
    items = [dict(zip(cols, row)) for row in rows]

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/api/http-codes")
def list_http_codes(profile: str = Query(...)):
    """Return distinct HTTP status codes present in the dataset for a profile."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT DISTINCT http_code FROM backlinks "
        "WHERE profile_label = $1 AND http_code IS NOT NULL AND http_code > 0 "
        "ORDER BY http_code",
        [profile],
    ).fetchall()
    return {"codes": [row[0] for row in rows]}
