from fastapi import APIRouter, Query
from db import get_conn

router = APIRouter()


@router.get("/api/link-gap")
def link_gap(
    base: str = Query(...),
    competitors: str = Query(...),
):
    """Find referring domains that link to competitors but not to the base profile.
    Sort by max DR descending."""
    conn = get_conn()
    competitor_list = [c.strip() for c in competitors.split(",") if c.strip()]

    if not competitor_list:
        return []

    # Build parameterized query for competitor profiles
    # DuckDB positional params: $1 = base, $2..$N+1 = competitors
    placeholders = ", ".join(f"${i + 2}" for i in range(len(competitor_list)))
    params = [base] + competitor_list

    rows = conn.execute(
        f"""
        SELECT
            referring_domain,
            MAX(domain_rating) AS max_dr,
            COUNT(*) AS total_links,
            LIST(DISTINCT profile_label) AS profiles_linking
        FROM backlinks
        WHERE profile_label IN ({placeholders})
          AND referring_domain NOT IN (
              SELECT DISTINCT referring_domain
              FROM backlinks
              WHERE profile_label = $1
          )
        GROUP BY referring_domain
        ORDER BY max_dr DESC NULLS LAST
        """,
        params,
    ).fetchall()

    cols = ["referring_domain", "max_dr", "total_links", "profiles_linking"]
    return [dict(zip(cols, row)) for row in rows]
