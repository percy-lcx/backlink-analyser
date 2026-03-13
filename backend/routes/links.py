from fastapi import APIRouter, Query
from typing import Optional
from db import get_conn

router = APIRouter()

SORTABLE_COLUMNS = {
    "domain_rating",
    "url_rating",
    "page_traffic",
    "first_seen",
    "last_seen",
    "referring_domain",
    "anchor",
    "target_path",
}


@router.get("/api/links")
def list_links(
    profile: str = Query(...),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=1000),
    sort: str = Query("domain_rating:desc"),
    is_nofollow: Optional[bool] = Query(None),
    is_spam: Optional[bool] = Query(None),
    link_type: Optional[str] = Query(None),
    dr_min: Optional[float] = Query(None),
    dr_max: Optional[float] = Query(None),
    anchor_search: Optional[str] = Query(None),
    domain_search: Optional[str] = Query(None),
    domain_exclude: Optional[bool] = Query(None),
    url_search: Optional[str] = Query(None),
    url_exclude: Optional[bool] = Query(None),
    target_path_search: Optional[str] = Query(None),
    target_path_exact: Optional[bool] = Query(None),
    target_path_exclude: Optional[bool] = Query(None),
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
        conditions.append(f"anchor ILIKE ${idx}")
        params.append(f"%{anchor_search}%")
        idx += 1

    if domain_search is not None:
        op = "NOT ILIKE" if domain_exclude else "ILIKE"
        conditions.append(f"referring_domain {op} ${idx}")
        params.append(f"%{domain_search}%")
        idx += 1

    if url_search is not None:
        op = "NOT ILIKE" if url_exclude else "ILIKE"
        conditions.append(f"referring_url {op} ${idx}")
        params.append(f"%{url_search}%")
        idx += 1

    if target_path_search is not None:
        if target_path_exact:
            op = "!=" if target_path_exclude else "="
            conditions.append(f"target_path {op} ${idx}")
            params.append(target_path_search)
        else:
            op = "NOT ILIKE" if target_path_exclude else "ILIKE"
            conditions.append(f"target_path {op} ${idx}")
            params.append(f"%{target_path_search}%")
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
