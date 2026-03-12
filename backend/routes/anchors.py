from fastapi import APIRouter, Query
from typing import Optional
from db import get_conn
from analysis.anchors import categorise_anchor, summarise_categories

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
):
    """Group by anchor, count, and categorise."""
    conn = get_conn()

    conditions = ["profile_label = $1"]
    params: list = [profile]

    if target_path is not None:
        conditions.append("target_path = $2")
        params.append(target_path)

    where = " AND ".join(conditions)

    rows = conn.execute(
        f"""
        SELECT
            anchor,
            link_type,
            COUNT(*) AS count
        FROM backlinks
        WHERE {where}
        GROUP BY anchor, link_type
        ORDER BY count DESC
        """,
        params,
    ).fetchall()

    items = []
    for row in rows:
        anchor_text, link_type_val, count = row
        cat = categorise_anchor(anchor_text, link_type_val)
        items.append({
            "anchor": anchor_text,
            "link_type": link_type_val,
            "count": count,
            "category": cat,
        })

    # Build summary
    all_rows = [{"anchor": r["anchor"], "link_type": r["link_type"], "category": r["category"]} for r in items for _ in range(r["count"])]
    summary = summarise_categories(all_rows)

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
