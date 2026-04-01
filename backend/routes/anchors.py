from fastapi import APIRouter, Query
from typing import Optional
from db import get_conn
from analysis.anchors import categorise_anchor, summarise_categories_weighted
from analysis.profile_terms import resolve_profile_terms
from routes._filters import apply_text_filter

router = APIRouter()


@router.get("/api/link-attributes")
def link_attributes(profile: str = Query(...)):
    """Group by link attribute combinations and count each."""
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT
            is_nofollow,
            is_ugc,
            is_sponsored,
            is_content,
            is_rendered,
            COUNT(*) AS count
        FROM backlinks
        WHERE profile_label = $1
        GROUP BY is_nofollow, is_ugc, is_sponsored, is_content, is_rendered
        ORDER BY count DESC
        """,
        [profile],
    ).fetchall()
    cols = ["is_nofollow", "is_ugc", "is_sponsored", "is_content", "is_rendered", "count"]
    return [dict(zip(cols, row)) for row in rows]


@router.get("/api/anchors")
def anchors(
    profile: str = Query(...),
    target_path: Optional[str] = Query(None),
    anchor_search: Optional[str] = Query(None),
    anchor_mode: Optional[str] = Query(None),
    anchor_exclude: Optional[bool] = Query(None),
    category: Optional[str] = Query(None),
    count_min: Optional[int] = Query(None),
    count_max: Optional[int] = Query(None),
):
    """Group by anchor, count, and categorise."""
    conn = get_conn()
    branded_terms, target_keywords, generic_anchors = resolve_profile_terms(profile, conn)

    conditions = ["profile_label = $1"]
    params: list = [profile]
    idx = 2

    if target_path is not None:
        conditions.append(f"target_path = ${idx}")
        params.append(target_path)
        idx += 1

    if anchor_search is not None:
        idx = apply_text_filter(
            conditions, params, idx, "anchor", anchor_search,
            mode=anchor_mode or "contains",
            exclude=bool(anchor_exclude),
        )

    where = " AND ".join(conditions)

    # HAVING clauses for count range
    having_parts: list[str] = []
    if count_min is not None:
        having_parts.append(f"COUNT(*) >= ${idx}")
        params.append(count_min)
        idx += 1
    if count_max is not None:
        having_parts.append(f"COUNT(*) <= ${idx}")
        params.append(count_max)
        idx += 1

    having = f"HAVING {' AND '.join(having_parts)}" if having_parts else ""

    rows = conn.execute(
        f"""
        SELECT
            anchor,
            link_type,
            COUNT(*) AS count
        FROM backlinks
        WHERE {where}
        GROUP BY anchor, link_type
        {having}
        ORDER BY count DESC
        """,
        params,
    ).fetchall()

    items = []
    for row in rows:
        anchor_text, link_type_val, count = row
        cat = categorise_anchor(anchor_text, link_type_val, branded_terms, target_keywords, generic_anchors)
        items.append({
            "anchor": anchor_text,
            "link_type": link_type_val,
            "count": count,
            "category": cat,
        })

    # Post-query filter by category (computed at query time, not a DB column)
    if category:
        items = [item for item in items if item["category"] == category]

    # Build summary from grouped counts — O(M) not O(N)
    summary = summarise_categories_weighted(items)

    return {
        "items": items,
        "categories": summary,
    }


@router.get("/api/anchors-context")
def anchors_context(
    profile: str = Query(...),
    anchor: str = Query(...),
):
    """Return left_context, anchor, right_context tuples for a given anchor."""
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT left_context, anchor, right_context
        FROM backlinks
        WHERE profile_label = $1 AND anchor = $2
        """,
        [profile, anchor],
    ).fetchall()
    cols = ["left_context", "anchor", "right_context"]
    return [dict(zip(cols, row)) for row in rows]
