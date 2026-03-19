from typing import Optional

from fastapi import APIRouter, Query
from db import get_conn

router = APIRouter()

RANKING_SORTABLE_COLUMNS = {
    "domain_rating",
    "page_traffic",
    "first_seen",
    "referring_domain",
    "anchor",
    "link_type",
    "current_position",
    "volume",
}


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
            ROUND(AVG(domain_rating), 1) AS avg_dr
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


@router.get("/api/keyword-suggestions")
def keyword_suggestions(
    q: str = Query(..., min_length=1, description="Partial keyword to search"),
    match: str = Query("contains", description="Match mode: 'exact' or 'contains'"),
):
    """Return top 20 keywords matching the query, ordered by search volume."""
    conn = get_conn()
    if not _has_keywords_view(conn):
        return []

    if match == "exact":
        where_clause = "WHERE keyword = $1"
    else:
        where_clause = "WHERE keyword ILIKE '%' || $1 || '%'"

    rows = conn.execute(
        f"""
        SELECT
            keyword,
            MAX(volume) AS volume,
            COUNT(DISTINCT profile_label) AS profile_count
        FROM organic_keywords
        {where_clause}
        GROUP BY keyword
        ORDER BY MAX(volume) DESC NULLS LAST
        LIMIT 20
        """,
        [q],
    ).fetchall()
    return [
        {"keyword": r[0], "volume": r[1], "profile_count": r[2]}
        for r in rows
    ]


@router.get("/api/keyword-ranking-urls")
def keyword_ranking_urls(
    keyword: str = Query(..., description="Keyword to search"),
    match: str = Query("contains", description="Match mode: 'exact' or 'contains'"),
    min_position: int = Query(1, ge=1, description="Minimum ranking position"),
    max_position: int = Query(100, ge=1, description="Maximum ranking position"),
    min_dr: Optional[int] = Query(None, description="Minimum domain rating filter on backlinks"),
    profiles: Optional[str] = Query(None, description="Comma-separated profile labels to scope keyword search"),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=1000),
    sort: str = Query("domain_rating:desc"),
):
    """Find URLs ranking for a keyword, then return all backlinks to those URLs.

    Two-step join: organic_keywords (filtered by keyword/position) → backlinks
    (joined on current_url = target_url).
    """
    conn = get_conn()
    if not _has_keywords_view(conn):
        return {
            "keyword_query": keyword,
            "ranking_urls": [],
            "items": [],
            "total": 0,
            "page": page,
            "per_page": per_page,
        }

    # Build keyword CTE conditions
    kw_match = "keyword = $1" if match == "exact" else "keyword ILIKE '%' || $1 || '%'"
    kw_conditions = [
        kw_match,
        f"current_position >= $2",
        f"current_position <= $3",
    ]
    params: list = [keyword, min_position, max_position]
    idx = 4

    if profiles:
        profile_list = [p.strip() for p in profiles.split(",") if p.strip()]
        if profile_list:
            placeholders = ", ".join(f"${idx + i}" for i in range(len(profile_list)))
            kw_conditions.append(f"profile_label IN ({placeholders})")
            params.extend(profile_list)
            idx += len(profile_list)

    kw_where = " AND ".join(kw_conditions)

    # First: get ranking URLs summary
    ranking_rows = conn.execute(
        f"""
        SELECT
            current_url,
            keyword,
            current_position,
            volume,
            organic_traffic,
            profile_label
        FROM organic_keywords
        WHERE {kw_where}
        ORDER BY current_position ASC, volume DESC NULLS LAST
        """,
        params,
    ).fetchall()

    ranking_urls = [
        {
            "url": r[0],
            "keyword": r[1],
            "position": r[2],
            "volume": r[3],
            "traffic": r[4],
            "profile_label": r[5],
        }
        for r in ranking_rows
    ]

    if not ranking_urls:
        return {
            "keyword_query": keyword,
            "ranking_urls": [],
            "items": [],
            "total": 0,
            "page": page,
            "per_page": per_page,
        }

    # Build backlinks query joining on target_url
    bl_conditions = []
    bl_params: list = list(params)  # reuse keyword params for the CTE
    bl_idx = idx

    if min_dr is not None:
        bl_conditions.append(f"b.domain_rating >= ${bl_idx}")
        bl_params.append(min_dr)
        bl_idx += 1

    bl_where = (" AND " + " AND ".join(bl_conditions)) if bl_conditions else ""

    # Parse sort
    sort_parts = sort.split(":")
    sort_col = sort_parts[0] if sort_parts[0] in RANKING_SORTABLE_COLUMNS else "domain_rating"
    sort_dir = "ASC" if len(sort_parts) > 1 and sort_parts[1].lower() == "asc" else "DESC"
    # Prefix sort column with table alias
    sort_prefix = "r." if sort_col in ("current_position", "volume") else "b."
    order_clause = f"{sort_prefix}{sort_col} {sort_dir} NULLS LAST"

    offset = (page - 1) * per_page

    cte = f"""
        WITH ranking_urls AS (
            SELECT DISTINCT current_url, keyword, current_position, volume, organic_traffic, profile_label
            FROM organic_keywords
            WHERE {kw_where}
        )
    """

    # Count total
    count_sql = f"""
        {cte}
        SELECT COUNT(*)
        FROM backlinks b
        INNER JOIN ranking_urls r ON b.target_url = r.current_url
        WHERE 1=1{bl_where}
    """
    total = conn.execute(count_sql, bl_params).fetchone()[0]

    # Fetch page
    data_sql = f"""
        {cte}
        SELECT
            b.referring_url,
            b.referring_domain,
            b.target_url,
            b.domain_rating,
            b.url_rating,
            b.anchor,
            b.link_type,
            b.page_traffic,
            b.domain_traffic,
            b.first_seen,
            b.is_nofollow,
            b.is_spam,
            b.profile_label AS backlink_profile,
            r.keyword,
            r.current_position,
            r.volume,
            r.organic_traffic AS keyword_traffic,
            r.profile_label AS keyword_profile
        FROM backlinks b
        INNER JOIN ranking_urls r ON b.target_url = r.current_url
        WHERE 1=1{bl_where}
        ORDER BY {order_clause}
        LIMIT {per_page} OFFSET {offset}
    """
    rows = conn.execute(data_sql, bl_params).fetchall()

    cols = [
        "referring_url", "referring_domain", "target_url", "domain_rating",
        "url_rating", "anchor", "link_type", "page_traffic", "domain_traffic",
        "first_seen", "is_nofollow", "is_spam", "backlink_profile",
        "keyword", "current_position", "volume", "keyword_traffic", "keyword_profile",
    ]
    items = []
    for row in rows:
        item = dict(zip(cols, row))
        if item["first_seen"] is not None:
            item["first_seen"] = str(item["first_seen"])
        items.append(item)

    return {
        "keyword_query": keyword,
        "ranking_urls": ranking_urls,
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
    }
