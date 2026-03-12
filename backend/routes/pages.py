from __future__ import annotations
from fastapi import APIRouter, Query
from db import get_conn
from analysis.categories import categorise_page

router = APIRouter()


@router.get("/api/page-breakdown")
def page_breakdown(profile: str = Query(...)):
    """Group by target_path, categorise, and aggregate per category."""
    conn = get_conn()

    rows = conn.execute(
        """
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
        WHERE profile_label = $1
        GROUP BY target_path
        ORDER BY link_count DESC
        """,
        [profile],
    ).fetchall()

    # Categorise each path and aggregate by category
    category_data: dict[str, dict] = {}
    pages = []
    for row in rows:
        target_path, link_count, unique_rds, avg_dr, df_ratio = row
        cat = categorise_page(target_path)
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
            "avg_dr": round(avg_dr_val, 2),
            "dofollow_ratio": round(df_ratio_val, 4),
        }

    return {
        "pages": pages,
        "categories": categories,
    }
