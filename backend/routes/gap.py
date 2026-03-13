from typing import Optional

from fastapi import APIRouter, Query
from db import get_conn

router = APIRouter()


@router.get("/api/link-gap")
def link_gap(
    base: str = Query(...),
    competitors: str = Query(...),
    base_target_path: Optional[str] = Query(None),
    competitor_target_path: Optional[str] = Query(None),
):
    """Find referring domains that link to competitors but not to the base profile.
    Sort by max DR descending.

    Optional ``base_target_path`` / ``competitor_target_path`` narrow the
    analysis to specific target URL paths within each profile.
    """
    conn = get_conn()
    competitor_list = [c.strip() for c in competitors.split(",") if c.strip()]

    if not competitor_list:
        return []

    # Build parameterized query for competitor profiles
    # DuckDB positional params: $1 = base, $2..$N+1 = competitors, then optional path params
    next_idx = 2
    placeholders = ", ".join(f"${i + next_idx}" for i in range(len(competitor_list)))
    params: list[str] = [base] + competitor_list
    next_idx += len(competitor_list)

    # Optional path filter for the competitor (outer) query
    comp_path_clause = ""
    if competitor_target_path:
        comp_path_clause = f" AND target_path = ${next_idx}"
        params.append(competitor_target_path)
        next_idx += 1

    # Optional path filter for the base (NOT IN subquery)
    base_path_clause = ""
    if base_target_path:
        base_path_clause = f" AND target_path = ${next_idx}"
        params.append(base_target_path)
        next_idx += 1

    rows = conn.execute(
        f"""
        SELECT
            referring_domain,
            MAX(domain_rating) AS max_dr,
            COUNT(*) AS total_links,
            LIST(DISTINCT profile_label) AS profiles_linking
        FROM backlinks
        WHERE profile_label IN ({placeholders}){comp_path_clause}
          AND COALESCE(is_spam, false) = false
          AND referring_domain NOT IN (
              SELECT DISTINCT referring_domain
              FROM backlinks
              WHERE profile_label = $1{base_path_clause}
          )
        GROUP BY referring_domain
        ORDER BY max_dr DESC NULLS LAST
        """,
        params,
    ).fetchall()

    cols = ["referring_domain", "max_dr", "total_links", "profiles_linking"]
    return [dict(zip(cols, row)) for row in rows]
