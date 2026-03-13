from fastapi import APIRouter, Query
from db import get_conn

router = APIRouter()


@router.get("/api/target-paths")
def target_paths(profile: str = Query(...)):
    """Return distinct target paths for a profile, ordered by link count descending."""
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT target_path, COUNT(*) AS link_count
        FROM backlinks
        WHERE profile_label = $1
          AND target_path IS NOT NULL
          AND target_path != ''
        GROUP BY target_path
        ORDER BY link_count DESC
        LIMIT 200
        """,
        [profile],
    ).fetchall()
    return [{"target_path": r[0], "link_count": r[1]} for r in rows]
