from typing import Optional

from fastapi import APIRouter, Query
from db import get_conn

router = APIRouter()


def _has_keywords_view(conn) -> bool:
    """Check if the organic_keywords view exists."""
    try:
        conn.execute("SELECT 1 FROM organic_keywords LIMIT 0")
        return True
    except Exception:
        return False


@router.get("/api/keyword-profiles")
def keyword_profiles():
    """List profiles that have organic keyword data."""
    conn = get_conn()
    if not _has_keywords_view(conn):
        return []
    rows = conn.execute(
        """
        SELECT
            profile_label,
            COUNT(*) AS keyword_count,
            SUM(organic_traffic) AS total_traffic
        FROM organic_keywords
        GROUP BY profile_label
        ORDER BY profile_label
        """
    ).fetchall()
    cols = ["profile_label", "keyword_count", "total_traffic"]
    return [dict(zip(cols, row)) for row in rows]


@router.get("/api/keyword-compare")
def keyword_compare(
    profile_a: str = Query(...),
    profile_b: str = Query(...),
    path_a: Optional[str] = Query(None),
    path_b: Optional[str] = Query(None),
):
    """Compare organic keywords between two profiles."""
    conn = get_conn()
    if not _has_keywords_view(conn):
        return {"error": "No keyword data available"}

    # Build path filter clauses
    params = [profile_a, profile_b]
    path_clause_a = ""
    path_clause_b = ""
    next_idx = 3
    if path_a:
        path_clause_a = f" AND current_url_path = ${next_idx}"
        params.append(path_a)
        next_idx += 1
    if path_b:
        path_clause_b = f" AND current_url_path = ${next_idx}"
        params.append(path_b)
        next_idx += 1

    # Per-profile summaries
    summary_rows = conn.execute(
        f"""
        SELECT
            profile_label,
            COUNT(*) AS total_keywords,
            SUM(organic_traffic) AS total_traffic,
            AVG(current_position) AS avg_position,
            AVG(kd) AS avg_kd
        FROM organic_keywords
        WHERE (profile_label = $1{path_clause_a})
           OR (profile_label = $2{path_clause_b})
        GROUP BY profile_label
        """,
        params,
    ).fetchall()
    summary_cols = ["profile", "total_keywords", "total_traffic", "avg_position", "avg_kd"]
    summaries = {r[0]: dict(zip(summary_cols, r)) for r in summary_rows}
    summary_a = summaries.get(profile_a, {"profile": profile_a, "total_keywords": 0, "total_traffic": 0, "avg_position": 0, "avg_kd": 0})
    summary_b = summaries.get(profile_b, {"profile": profile_b, "total_keywords": 0, "total_traffic": 0, "avg_position": 0, "avg_kd": 0})

    # Keyword overlap/gap using FULL OUTER JOIN
    join_params = list(params)  # reuse same params
    rows = conn.execute(
        f"""
        WITH kw_a AS (
            SELECT keyword, country_code, volume, kd, cpc, organic_traffic, current_position, serp_features
            FROM organic_keywords
            WHERE profile_label = $1{path_clause_a}
        ),
        kw_b AS (
            SELECT keyword, country_code, volume, kd, cpc, organic_traffic, current_position, serp_features
            FROM organic_keywords
            WHERE profile_label = $2{path_clause_b}
        )
        SELECT
            COALESCE(a.keyword, b.keyword) AS keyword,
            COALESCE(a.country_code, b.country_code) AS country_code,
            COALESCE(a.volume, b.volume) AS volume,
            COALESCE(a.kd, b.kd) AS kd,
            a.current_position AS position_a,
            b.current_position AS position_b,
            a.organic_traffic AS traffic_a,
            b.organic_traffic AS traffic_b,
            CASE
                WHEN a.keyword IS NOT NULL AND b.keyword IS NOT NULL THEN 'shared'
                WHEN a.keyword IS NOT NULL THEN 'only_a'
                ELSE 'only_b'
            END AS overlap_type
        FROM kw_a a
        FULL OUTER JOIN kw_b b ON a.keyword = b.keyword AND a.country_code = b.country_code
        ORDER BY COALESCE(a.volume, b.volume) DESC NULLS LAST
        """,
        join_params,
    ).fetchall()

    shared = []
    only_a = []
    only_b = []
    for r in rows:
        kw_row = {
            "keyword": r[0], "country_code": r[1], "volume": r[2], "kd": r[3],
        }
        if r[8] == "shared":
            kw_row.update({"position_a": r[4], "position_b": r[5], "traffic_a": r[6], "traffic_b": r[7]})
            shared.append(kw_row)
        elif r[8] == "only_a":
            kw_row.update({"position": r[4], "traffic": r[6]})
            only_a.append(kw_row)
        else:
            kw_row.update({"position": r[5], "traffic": r[7]})
            only_b.append(kw_row)

    # Intent distribution per profile
    intent_params = list(params)
    intent_rows = conn.execute(
        f"""
        SELECT
            profile_label,
            SUM(CASE WHEN is_informational THEN 1 ELSE 0 END) AS informational,
            SUM(CASE WHEN is_commercial THEN 1 ELSE 0 END) AS commercial,
            SUM(CASE WHEN is_transactional THEN 1 ELSE 0 END) AS transactional,
            SUM(CASE WHEN is_navigational THEN 1 ELSE 0 END) AS navigational,
            SUM(CASE WHEN is_branded THEN 1 ELSE 0 END) AS branded,
            SUM(CASE WHEN is_local THEN 1 ELSE 0 END) AS local_intent
        FROM organic_keywords
        WHERE (profile_label = $1{path_clause_a})
           OR (profile_label = $2{path_clause_b})
        GROUP BY profile_label
        """,
        intent_params,
    ).fetchall()
    intent_cols = ["informational", "commercial", "transactional", "navigational", "branded", "local"]
    intent_a = {}
    intent_b = {}
    for r in intent_rows:
        dist = dict(zip(intent_cols, r[1:]))
        if r[0] == profile_a:
            intent_a = dist
        else:
            intent_b = dist

    # SERP feature distribution per profile
    serp_params = list(params)
    serp_rows = conn.execute(
        f"""
        SELECT
            profile_label,
            TRIM(feature.unnest) AS feature,
            COUNT(*) AS cnt
        FROM organic_keywords,
             LATERAL unnest(string_split(serp_features, ', ')) AS feature
        WHERE (profile_label = $1{path_clause_a})
           OR (profile_label = $2{path_clause_b})
        GROUP BY profile_label, feature.unnest
        HAVING TRIM(feature.unnest) != ''
        ORDER BY cnt DESC
        """,
        serp_params,
    ).fetchall()
    serp_a = {}
    serp_b = {}
    for r in serp_rows:
        if r[0] == profile_a:
            serp_a[r[1]] = r[2]
        else:
            serp_b[r[1]] = r[2]

    return {
        "summary_a": summary_a,
        "summary_b": summary_b,
        "shared_keywords": shared,
        "only_a": only_a,
        "only_b": only_b,
        "intent_distribution_a": intent_a,
        "intent_distribution_b": intent_b,
        "serp_features_a": serp_a,
        "serp_features_b": serp_b,
    }


@router.get("/api/keyword-combined")
def keyword_combined(
    profile_a: str = Query(...),
    profile_b: str = Query(...),
):
    """Combined backlink + keyword insights for two profiles."""
    conn = get_conn()
    has_keywords = _has_keywords_view(conn)

    rows = conn.execute(
        """
        SELECT
            profile_label,
            COUNT(*) AS total_links,
            COUNT(DISTINCT referring_domain) AS ref_domains,
            AVG(domain_rating) AS avg_dr
        FROM backlinks
        WHERE profile_label IN ($1, $2)
        GROUP BY profile_label
        """,
        [profile_a, profile_b],
    ).fetchall()
    bl_cols = ["profile_label", "total_links", "ref_domains", "avg_dr"]
    bl_data = {r[0]: dict(zip(bl_cols, r)) for r in rows}

    kw_data = {}
    if has_keywords:
        kw_rows = conn.execute(
            """
            SELECT
                profile_label,
                COUNT(*) AS total_keywords,
                SUM(organic_traffic) AS total_traffic,
                AVG(current_position) AS avg_position
            FROM organic_keywords
            WHERE profile_label IN ($1, $2)
            GROUP BY profile_label
            """,
            [profile_a, profile_b],
        ).fetchall()
        kw_cols = ["profile_label", "total_keywords", "total_traffic", "avg_position"]
        kw_data = {r[0]: dict(zip(kw_cols, r)) for r in kw_rows}

    result = []
    for label in [profile_a, profile_b]:
        entry = {"profile_label": label}
        bl = bl_data.get(label, {})
        kw = kw_data.get(label, {})
        entry["total_links"] = bl.get("total_links", 0)
        entry["ref_domains"] = bl.get("ref_domains", 0)
        entry["avg_dr"] = bl.get("avg_dr", 0)
        entry["total_keywords"] = kw.get("total_keywords", 0)
        entry["total_traffic"] = kw.get("total_traffic", 0)
        entry["avg_position"] = kw.get("avg_position", 0)
        result.append(entry)

    return result
