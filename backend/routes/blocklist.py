"""Endpoints for managing the domain blocklist."""

from fastapi import APIRouter, Query
from pydantic import BaseModel

from blocklist import get_blocklist, set_blocklist
from db import get_conn

router = APIRouter()


class SaveBlocklistBody(BaseModel):
    domains: list[str]


@router.get("/api/blocklist")
def read_blocklist():
    return {"domains": get_blocklist()}


@router.post("/api/blocklist")
def write_blocklist(body: SaveBlocklistBody):
    set_blocklist(body.domains)
    return {"status": "ok"}


@router.post("/api/blocklist/auto-zero-traffic")
def auto_block_zero_traffic(profile: str = Query(...)):
    """Add all referring domains with 0 domain traffic to the blocklist."""
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT referring_domain
        FROM backlinks
        WHERE profile_label = $1
        GROUP BY referring_domain
        HAVING MAX(COALESCE(domain_traffic, 0)) = 0
        """,
        [profile],
    ).fetchall()
    zero_domains = {row[0] for row in rows}
    existing = set(get_blocklist())
    added = zero_domains - existing
    merged = sorted(existing | zero_domains)
    set_blocklist(merged)
    return {"added": len(added), "total": len(merged)}
