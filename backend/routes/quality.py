from fastapi import APIRouter, Query
from db import get_conn

router = APIRouter()


@router.get("/api/quality-matrix")
def quality_matrix(
    profile: str = Query(...),
    page: int = Query(1, ge=1),
    per_page: int = Query(1000, ge=1, le=5000),
):
    """Return domain_rating, page_traffic, is_spam, link_type, referring_url.
    Ordered by page_traffic desc. Paginated."""
    conn = get_conn()

    total = conn.execute(
        "SELECT COUNT(*) FROM backlinks WHERE profile_label = $1",
        [profile],
    ).fetchone()[0]

    offset = (page - 1) * per_page
    rows = conn.execute(
        f"""
        SELECT
            domain_rating,
            page_traffic,
            is_spam,
            link_type,
            referring_url
        FROM backlinks
        WHERE profile_label = $1
        ORDER BY page_traffic DESC NULLS LAST
        LIMIT {per_page} OFFSET {offset}
        """,
        [profile],
    ).fetchall()

    cols = ["domain_rating", "page_traffic", "is_spam", "link_type", "referring_url"]
    return {
        "items": [dict(zip(cols, row)) for row in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
    }
