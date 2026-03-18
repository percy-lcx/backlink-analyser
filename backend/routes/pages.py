from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Query
from db import get_conn
from analysis.categories import categorise_page
from routes._filters import apply_text_filter

router = APIRouter()


@router.get("/api/page-breakdown")
def page_breakdown(
    profile: str = Query(...),
    target_path_search: Optional[str] = Query(None),
    target_path_exclude: Optional[bool] = Query(None),
    target_path_mode: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    link_count_min: Optional[int] = Query(None),
    link_count_max: Optional[int] = Query(None),
    ref_domains_min: Optional[int] = Query(None),
    ref_domains_max: Optional[int] = Query(None),
    avg_dr_min: Optional[float] = Query(None),
    avg_dr_max: Optional[float] = Query(None),
    dofollow_min: Optional[float] = Query(None),
    dofollow_max: Optional[float] = Query(None),
):
    """Group by target_path, categorise, and aggregate per category."""
    conn = get_conn()

    conditions = ["profile_label = $1"]
    params: list = [profile]
    idx = 2

    if target_path_search is not None:
        idx = apply_text_filter(
            conditions, params, idx, "target_path", target_path_search,
            mode=target_path_mode or "contains",
            exclude=bool(target_path_exclude),
        )

    where = " AND ".join(conditions)

    # HAVING clauses for post-aggregation numeric filters
    having_parts: list[str] = []
    if link_count_min is not None:
        having_parts.append(f"COUNT(*) >= ${idx}")
        params.append(link_count_min)
        idx += 1
    if link_count_max is not None:
        having_parts.append(f"COUNT(*) <= ${idx}")
        params.append(link_count_max)
        idx += 1
    if ref_domains_min is not None:
        having_parts.append(f"COUNT(DISTINCT referring_domain) >= ${idx}")
        params.append(ref_domains_min)
        idx += 1
    if ref_domains_max is not None:
        having_parts.append(f"COUNT(DISTINCT referring_domain) <= ${idx}")
        params.append(ref_domains_max)
        idx += 1
    if avg_dr_min is not None:
        having_parts.append(f"AVG(domain_rating) >= ${idx}")
        params.append(avg_dr_min)
        idx += 1
    if avg_dr_max is not None:
        having_parts.append(f"AVG(domain_rating) <= ${idx}")
        params.append(avg_dr_max)
        idx += 1

    having = f"HAVING {' AND '.join(having_parts)}" if having_parts else ""

    rows = conn.execute(
        f"""
        SELECT
            target_path,
            COUNT(*) AS link_count,
            COUNT(DISTINCT referring_domain) AS unique_referring_domains,
            AVG(domain_rating) AS avg_dr,
            CASE WHEN COUNT(*) > 0
                THEN COUNT(*) FILTER (
                    WHERE COALESCE(is_nofollow, false) = false
                      AND COALESCE(is_ugc, false) = false
                      AND COALESCE(is_sponsored, false) = false
                )::FLOAT / COUNT(*)
                ELSE 0 END AS dofollow_ratio
        FROM backlinks
        WHERE {where}
        GROUP BY target_path
        {having}
        ORDER BY link_count DESC
        """,
        params,
    ).fetchall()

    # Categorise each path and aggregate by category
    category_data: dict[str, dict] = {}
    pages = []
    for row in rows:
        target_path, link_count, unique_rds, avg_dr, df_ratio = row
        cat = categorise_page(target_path)

        # Post-query filter: category (computed field)
        if category and cat != category:
            continue

        # Post-query filter: dofollow ratio range (computed field, 0-1 scale)
        if dofollow_min is not None and (df_ratio or 0) < dofollow_min:
            continue
        if dofollow_max is not None and (df_ratio or 0) > dofollow_max:
            continue

        pages.append({
            "target_path": target_path,
            "category": cat,
            "link_count": link_count,
            "unique_referring_domains": unique_rds,
            "avg_dr": avg_dr,
            "dofollow_ratio": df_ratio,
        })
        if cat not in category_data:
            category_data[cat] = {
                "link_count": 0,
                "unique_referring_domains": 0,
                "dr_sum": 0.0,
                "dr_weight": 0,
                "dofollow_ratios": [],
            }
        cd = category_data[cat]
        cd["link_count"] += link_count
        cd["unique_referring_domains"] += unique_rds
        if avg_dr is not None:
            cd["dr_sum"] += avg_dr * link_count
            cd["dr_weight"] += link_count
        cd["dofollow_ratios"].append((df_ratio, link_count))

    # Build category summary
    categories = {}
    for cat, cd in category_data.items():
        total_links = cd["link_count"]
        avg_dr_val = cd["dr_sum"] / cd["dr_weight"] if cd["dr_weight"] > 0 else 0
        weighted_df = sum(r * w for r, w in cd["dofollow_ratios"])
        total_w = sum(w for _, w in cd["dofollow_ratios"])
        df_ratio_val = weighted_df / total_w if total_w > 0 else 0
        categories[cat] = {
            "link_count": total_links,
            "unique_referring_domains": cd["unique_referring_domains"],
            "avg_dr": round(avg_dr_val, 1),
            "dofollow_ratio": round(df_ratio_val, 4),
        }

    return {
        "pages": pages,
        "categories": categories,
    }
