"""Endpoints for managing the domain blocklist."""

from fastapi import APIRouter
from pydantic import BaseModel

from blocklist import get_blocklist, set_blocklist

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
