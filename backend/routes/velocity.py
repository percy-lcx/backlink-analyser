from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Query
from db import get_conn

router = APIRouter()


@router.get("/api/dr-distribution")
def dr_distribution(
    profile: str = Query(...),
    target_path: Optional[str] = Query(None),
):
    """DR and UR histogram with buckets 0-10, 11-20, ..., 91-100.

    Optional ``target_path`` narrows the distribution to backlinks
    pointing at a specific URL path.
    """
    conn = get_conn()

    where = "WHERE profile_label = $1"
    params: list[str] = [profile]
    if target_path:
        where += " AND target_path = $2"
        params.append(target_path)

    dr_rows = conn.execute(
        f"""
        SELECT
            CASE
                WHEN domain_rating <= 10 THEN '0-10'
                WHEN domain_rating <= 20 THEN '11-20'
                WHEN domain_rating <= 30 THEN '21-30'
                WHEN domain_rating <= 40 THEN '31-40'
                WHEN domain_rating <= 50 THEN '41-50'
                WHEN domain_rating <= 60 THEN '51-60'
                WHEN domain_rating <= 70 THEN '61-70'
                WHEN domain_rating <= 80 THEN '71-80'
                WHEN domain_rating <= 90 THEN '81-90'
                ELSE '91-100'
            END AS bucket,
            COUNT(*) AS count
        FROM backlinks
        {where}
        GROUP BY bucket
        ORDER BY bucket
        """,
        params,
    ).fetchall()

    ur_rows = conn.execute(
        f"""
        SELECT
            CASE
                WHEN url_rating <= 10 THEN '0-10'
                WHEN url_rating <= 20 THEN '11-20'
                WHEN url_rating <= 30 THEN '21-30'
                WHEN url_rating <= 40 THEN '31-40'
                WHEN url_rating <= 50 THEN '41-50'
                WHEN url_rating <= 60 THEN '51-60'
                WHEN url_rating <= 70 THEN '61-70'
                WHEN url_rating <= 80 THEN '71-80'
                WHEN url_rating <= 90 THEN '81-90'
                ELSE '91-100'
            END AS bucket,
            COUNT(*) AS count
        FROM backlinks
        {where}
        GROUP BY bucket
        ORDER BY bucket
        """,
        params,
    ).fetchall()

    return {
        "dr": [{"bucket": r[0], "count": r[1]} for r in dr_rows],
        "ur": [{"bucket": r[0], "count": r[1]} for r in ur_rows],
    }


@router.get("/api/velocity")
def velocity(
    profile: str = Query(...),
    interval: str = Query("week"),
    target_path: Optional[str] = Query(None),
):
    """Link velocity: new links grouped by week or month."""
    if interval not in ("week", "month"):
        interval = "week"

    conn = get_conn()

    path_filter = ""
    params: list[str] = [profile]
    if target_path:
        path_filter = " AND target_path = $2"
        params.append(target_path)

    # Single CTE query combining new and new-by-status
    rows = conn.execute(
        f"""
        WITH new AS (
            SELECT
                DATE_TRUNC('{interval}', first_seen) AS period,
                COUNT(*) AS new_count
            FROM backlinks
            WHERE profile_label = $1 AND first_seen IS NOT NULL{path_filter}
            GROUP BY period
        ),
        new_by_status AS (
            SELECT
                DATE_TRUNC('{interval}', first_seen) AS period,
                discovered_status,
                COUNT(*) AS count
            FROM backlinks
            WHERE profile_label = $1 AND first_seen IS NOT NULL{path_filter}
            GROUP BY period, discovered_status
        )
        SELECT
            n.period,
            n.new_count,
            ns.discovered_status,
            COALESCE(ns.count, 0) AS status_count
        FROM new n
        LEFT JOIN new_by_status ns ON n.period = ns.period
        ORDER BY n.period, ns.discovered_status
        """,
        params,
    ).fetchall()

    # Merge rows into timeline (multiple rows per period when statuses exist)
    timeline: dict[str, dict] = {}
    for r in rows:
        period_key = str(r[0])
        if period_key not in timeline:
            timeline[period_key] = {
                "period": period_key,
                "new_count": r[1],
                "new_by_status": {},
            }
        status = r[2]
        status_count = r[3]
        if status is not None and status_count:
            timeline[period_key]["new_by_status"][status or "unknown"] = status_count

    return list(timeline.values())
