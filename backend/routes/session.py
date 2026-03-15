"""Endpoints for saving and loading per-tab filter state."""

from typing import Any

from fastapi import APIRouter, Query, Request, Response
from pydantic import BaseModel

from session import get_or_create_session, get_filters, set_filters

router = APIRouter()

VALID_TABS = {"links", "anchors", "domains", "pages"}


class SaveFiltersBody(BaseModel):
    profile: str
    tab: str
    filters: dict[str, Any]


@router.get("/api/session/filters")
def load_filters(
    request: Request,
    response: Response,
    profile: str = Query(...),
    tab: str = Query(...),
):
    session_id = get_or_create_session(request, response)
    if tab not in VALID_TABS:
        return {"filters": {}}
    return {"filters": get_filters(session_id, profile, tab)}


@router.post("/api/session/filters")
def save_filters(request: Request, response: Response, body: SaveFiltersBody):
    session_id = get_or_create_session(request, response)
    if body.tab not in VALID_TABS:
        return {"status": "invalid tab"}
    set_filters(session_id, body.profile, body.tab, body.filters)
    return {"status": "ok"}
