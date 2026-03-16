from typing import Optional

from fastapi import APIRouter, Query
from db import get_conn

router = APIRouter()


@router.get("/api/link-intersect")
def link_intersect(
    base: str = Query(..., description="Your profile label"),
    competitors: str = Query(
        ..., description="Comma-separated competitor profile labels"
    ),
    min_dr: Optional[int] = Query(None, description="Minimum domain rating filter"),
):
    """Multi-competitor link intersect report.

    For every referring domain that links to at least one competitor but NOT to
    the base profile, report *which* competitors it links to.  This lets the
    user find domains linking to ALL competitors (strongest opportunities) or
    any subset.

    Returns
    -------
    - ``competitors``  – ordered list of competitor labels (for column mapping)
    - ``summary``      – list of {count, domains} where *count* is the number
                         of competitors a domain links to
    - ``domains``      – per-domain detail: referring_domain, max_dr,
                         total_links, competitor_flags (bool[]), competitor_count
    """
    conn = get_conn()
    competitor_list = [c.strip() for c in competitors.split(",") if c.strip()]
    if not competitor_list:
        return {"competitors": [], "summary": [], "domains": []}

    # --- build parameterised query ---
    # $1 = base label
    # $2..$N+1 = competitor labels
    comp_placeholders = ", ".join(
        f"${i + 2}" for i in range(len(competitor_list))
    )
    params: list = [base] + competitor_list

    dr_clause = ""
    if min_dr is not None:
        params.append(min_dr)
        dr_clause = f" AND max_dr >= ${len(params)}"

    # One CTE to collect all referring domains per competitor, excluding base.
    # Second CTE pivots to get boolean flags per competitor.
    # We build a CASE column for each competitor to get the flag array.
    flag_cols = ", ".join(
        f"MAX(CASE WHEN profile_label = ${i + 2} THEN true ELSE false END) AS flag_{i}"
        for i in range(len(competitor_list))
    )
    flag_select = ", ".join(f"flag_{i}" for i in range(len(competitor_list)))
    count_expr = " + ".join(
        f"CAST(flag_{i} AS INTEGER)" for i in range(len(competitor_list))
    )

    sql = f"""
        WITH base_domains AS (
            SELECT DISTINCT referring_domain
            FROM backlinks
            WHERE profile_label = $1
        ),
        comp_domains AS (
            SELECT
                b.referring_domain,
                b.profile_label,
                MAX(b.domain_rating) AS dr
            FROM backlinks b
            LEFT JOIN base_domains bd ON b.referring_domain = bd.referring_domain
            WHERE b.profile_label IN ({comp_placeholders})
              AND COALESCE(b.is_spam, false) = false
              AND bd.referring_domain IS NULL
            GROUP BY b.referring_domain, b.profile_label
        ),
        pivoted AS (
            SELECT
                referring_domain,
                MAX(dr) AS max_dr,
                {flag_cols},
                {count_expr} AS competitor_count
            FROM comp_domains
            GROUP BY referring_domain
        )
        SELECT
            referring_domain,
            max_dr,
            {flag_select},
            competitor_count
        FROM pivoted
        WHERE competitor_count >= 1{dr_clause}
        ORDER BY competitor_count DESC, max_dr DESC NULLS LAST
    """

    rows = conn.execute(sql, params).fetchall()

    # Build response
    domains = []
    # summary buckets: competitor_count -> number of domains
    summary_map: dict[int, int] = {}
    for row in rows:
        ref_domain = row[0]
        max_dr = row[1]
        flags = [bool(row[2 + i]) for i in range(len(competitor_list))]
        comp_count = row[2 + len(competitor_list)]
        domains.append(
            {
                "referring_domain": ref_domain,
                "max_dr": max_dr,
                "competitor_flags": flags,
                "competitor_count": comp_count,
            }
        )
        summary_map[comp_count] = summary_map.get(comp_count, 0) + 1

    # Build ordered summary from max possible down to 1
    summary = []
    for n in range(len(competitor_list), 0, -1):
        summary.append({"count": n, "domains": summary_map.get(n, 0)})

    return {
        "competitors": competitor_list,
        "summary": summary,
        "domains": domains,
    }


@router.get("/api/gap-domain-breakdown")
def gap_domain_breakdown(
    referring_domain: str = Query(..., description="Referring domain to drill into"),
    base: str = Query(..., description="Your profile label"),
    competitors: str = Query(
        ..., description="Comma-separated competitor profile labels"
    ),
):
    """Return individual referring pages for a gap domain.

    Given a referring domain that links to competitors but not the base profile,
    return all individual backlink rows from that domain across competitors.
    """
    conn = get_conn()
    competitor_list = [c.strip() for c in competitors.split(",") if c.strip()]
    if not competitor_list:
        return {"referring_domain": referring_domain, "rows": []}

    # $1 = base, $2 = referring_domain, $3..$N+2 = competitors
    comp_placeholders = ", ".join(
        f"${i + 3}" for i in range(len(competitor_list))
    )
    params: list = [base, referring_domain] + competitor_list

    sql = f"""
        WITH base_domains AS (
            SELECT DISTINCT referring_domain
            FROM backlinks
            WHERE profile_label = $1
        )
        SELECT
            b.referring_url,
            b.target_url,
            b.profile_label,
            b.domain_rating,
            b.page_traffic,
            b.domain_traffic,
            b.anchor,
            b.link_type,
            b.first_seen
        FROM backlinks b
        LEFT JOIN base_domains bd ON b.referring_domain = bd.referring_domain
        WHERE b.referring_domain = $2
          AND b.profile_label IN ({comp_placeholders})
          AND COALESCE(b.is_spam, false) = false
          AND bd.referring_domain IS NULL
        ORDER BY b.page_traffic DESC NULLS LAST
    """

    rows = conn.execute(sql, params).fetchall()

    return {
        "referring_domain": referring_domain,
        "rows": [
            {
                "referring_url": r[0],
                "target_url": r[1],
                "profile_label": r[2],
                "domain_rating": r[3],
                "page_traffic": r[4],
                "domain_traffic": r[5],
                "anchor": r[6],
                "link_type": r[7],
                "first_seen": str(r[8]) if r[8] else None,
            }
            for r in rows
        ],
    }
