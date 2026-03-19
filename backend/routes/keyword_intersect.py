from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from db import get_conn

router = APIRouter()


RANKED_URL_COLUMNS = [
    "profile_label",
    "keyword",
    "current_position",
    "current_url",
    "current_url_domain",
    "current_url_path",
    "organic_traffic",
    "volume",
]


def _has_keywords_view(conn) -> bool:
    """Check if the organic_keywords view exists."""
    try:
        conn.execute("SELECT 1 FROM organic_keywords LIMIT 0")
        return True
    except Exception:
        return False


def _parse_profiles(profiles: Optional[str]) -> list[str]:
    if not profiles:
        return []
    return [profile.strip() for profile in profiles.split(",") if profile.strip()]


@router.get("/api/keyword-backlink-intersect")
def keyword_backlink_intersect(
    query: Optional[str] = Query(None, description="Keyword to match"),
    keyword: Optional[str] = Query(None, description="Keyword to match"),
    position_from: int = Query(..., ge=1),
    position_to: int = Query(..., ge=1),
    url_limit: int = Query(..., ge=1, le=1000),
    profiles: Optional[str] = Query(None, description="Comma-separated profile labels"),
    min_dr: Optional[float] = Query(None, ge=0),
    exclude_spam: Optional[bool] = Query(None),
    dofollow_only: Optional[bool] = Query(None),
    include_backlink_rows: bool = Query(False),
):
    """Return ranked keyword URLs plus backlink rollups for the selected SERP slice."""
    conn = get_conn()
    if not _has_keywords_view(conn):
        return {
            "keyword": keyword or query,
            "ranked_urls": [],
            "backlink_summary": [],
            "backlink_rows": [],
        }

    selected_keyword = (keyword or query or "").strip()
    if not selected_keyword:
        raise HTTPException(status_code=400, detail="Either 'keyword' or 'query' is required")

    if position_from > position_to:
        raise HTTPException(status_code=400, detail="position_from must be less than or equal to position_to")

    selected_profiles = _parse_profiles(profiles)

    ranked_conditions = ["keyword = $1", "current_position BETWEEN $2 AND $3"]
    ranked_params: list = [selected_keyword, position_from, position_to]
    next_idx = 4

    if selected_profiles:
        profile_placeholders = ", ".join(
            f"${next_idx + i}" for i in range(len(selected_profiles))
        )
        ranked_conditions.append(f"profile_label IN ({profile_placeholders})")
        ranked_params.extend(selected_profiles)
        next_idx += len(selected_profiles)

    ranked_params.append(url_limit)
    limit_placeholder = f"${next_idx}"
    ranked_where = " AND ".join(ranked_conditions)

    ranked_urls_sql = f"""
        WITH ranked_urls AS (
            SELECT
                profile_label,
                keyword,
                current_position,
                current_url,
                current_url_domain,
                current_url_path,
                organic_traffic,
                volume
            FROM organic_keywords
            WHERE {ranked_where}
            ORDER BY current_position ASC, profile_label ASC, current_url ASC
            LIMIT {limit_placeholder}
        )
        SELECT
            profile_label,
            keyword,
            current_position,
            current_url,
            current_url_domain,
            current_url_path,
            organic_traffic,
            volume
        FROM ranked_urls
        ORDER BY current_position ASC, profile_label ASC, current_url ASC
    """
    ranked_rows = conn.execute(ranked_urls_sql, ranked_params).fetchall()
    ranked_urls = [dict(zip(RANKED_URL_COLUMNS, row)) for row in ranked_rows]

    backlink_join_conditions = [
        "b.profile_label = ru.profile_label",
        "b.target_domain = ru.current_url_domain",
        "b.target_path = ru.current_url_path",
    ]
    summary_params = list(ranked_params)
    next_idx = len(summary_params) + 1

    if min_dr is not None:
        backlink_join_conditions.append(f"b.domain_rating >= ${next_idx}")
        summary_params.append(min_dr)
        next_idx += 1

    if exclude_spam:
        backlink_join_conditions.append("COALESCE(b.is_spam, false) = false")

    if dofollow_only:
        backlink_join_conditions.append("COALESCE(b.is_nofollow, false) = false")

    backlink_join = " AND ".join(backlink_join_conditions)

    backlink_summary_sql = f"""
        WITH ranked_urls AS (
            SELECT
                profile_label,
                keyword,
                current_position,
                current_url,
                current_url_domain,
                current_url_path,
                organic_traffic,
                volume
            FROM organic_keywords
            WHERE {ranked_where}
            ORDER BY current_position ASC, profile_label ASC, current_url ASC
            LIMIT {limit_placeholder}
        )
        SELECT
            ru.profile_label,
            ru.keyword,
            ru.current_position,
            ru.current_url,
            ru.organic_traffic,
            ru.volume,
            COUNT(b.referring_url) AS backlink_count,
            COUNT(DISTINCT b.referring_domain) AS unique_referring_domains,
            COALESCE(ROUND(AVG(b.domain_rating), 1), 0) AS avg_dr,
            CASE
                WHEN COUNT(b.referring_url) > 0 THEN ROUND(
                    COUNT(*) FILTER (WHERE COALESCE(b.is_nofollow, false) = false)::DOUBLE
                    / COUNT(b.referring_url),
                    4
                )
                ELSE 0
            END AS dofollow_ratio
        FROM ranked_urls ru
        LEFT JOIN backlinks b
          ON {backlink_join}
        GROUP BY
            ru.profile_label,
            ru.keyword,
            ru.current_position,
            ru.current_url,
            ru.organic_traffic,
            ru.volume
        ORDER BY ru.current_position ASC, ru.profile_label ASC, ru.current_url ASC
    """
    summary_rows = conn.execute(backlink_summary_sql, summary_params).fetchall()
    backlink_summary = [
        {
            "profile_label": row[0],
            "keyword": row[1],
            "current_position": row[2],
            "current_url": row[3],
            "organic_traffic": row[4],
            "volume": row[5],
            "backlink_count": row[6],
            "unique_referring_domains": row[7],
            "avg_dr": row[8],
            "dofollow_ratio": row[9],
        }
        for row in summary_rows
    ]

    backlink_rows = []
    if include_backlink_rows and ranked_urls:
        backlink_rows_sql = f"""
            WITH ranked_urls AS (
                SELECT
                    profile_label,
                    keyword,
                    current_position,
                    current_url,
                    current_url_domain,
                    current_url_path,
                    organic_traffic,
                    volume
                FROM organic_keywords
                WHERE {ranked_where}
                ORDER BY current_position ASC, profile_label ASC, current_url ASC
                LIMIT {limit_placeholder}
            )
            SELECT
                ru.profile_label,
                ru.keyword,
                ru.current_position,
                ru.current_url,
                ru.organic_traffic,
                ru.volume,
                b.referring_domain,
                b.referring_url,
                b.target_url,
                b.target_domain,
                b.target_path,
                b.domain_rating,
                b.page_traffic,
                b.link_type,
                b.anchor,
                b.first_seen,
                b.last_seen,
                b.is_nofollow,
                b.is_spam
            FROM ranked_urls ru
            LEFT JOIN backlinks b
              ON {backlink_join}
            WHERE b.referring_url IS NOT NULL
            ORDER BY
                ru.current_position ASC,
                ru.profile_label ASC,
                ru.current_url ASC,
                b.domain_rating DESC NULLS LAST,
                b.referring_url ASC
        """
        backlink_detail_rows = conn.execute(backlink_rows_sql, summary_params).fetchall()
        backlink_rows = [
            {
                "profile_label": row[0],
                "keyword": row[1],
                "current_position": row[2],
                "current_url": row[3],
                "organic_traffic": row[4],
                "volume": row[5],
                "referring_domain": row[6],
                "referring_url": row[7],
                "target_url": row[8],
                "target_domain": row[9],
                "target_path": row[10],
                "domain_rating": row[11],
                "page_traffic": row[12],
                "link_type": row[13],
                "anchor": row[14],
                "first_seen": str(row[15]) if row[15] else None,
                "last_seen": str(row[16]) if row[16] else None,
                "is_nofollow": row[17],
                "is_spam": row[18],
            }
            for row in backlink_detail_rows
        ]

    return {
        "keyword": selected_keyword,
        "position_from": position_from,
        "position_to": position_to,
        "url_limit": url_limit,
        "profiles": selected_profiles,
        "ranked_urls": ranked_urls,
        "backlink_summary": backlink_summary,
        "backlink_rows": backlink_rows,
    }
