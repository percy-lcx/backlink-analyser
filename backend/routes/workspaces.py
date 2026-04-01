from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from db import get_conn
from workspaces import get_workspaces, set_workspaces, set_active_workspace

router = APIRouter()


class WorkspacesPayload(BaseModel):
    active: Optional[str] = None
    workspaces: dict


class ActivePayload(BaseModel):
    name: Optional[str] = None


@router.get("/api/workspaces")
def get_workspaces_route():
    """Return workspace config plus all available dataset labels."""
    ws = get_workspaces()
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT DISTINCT profile_label FROM backlinks ORDER BY profile_label"
        ).fetchall()
        ws["all_datasets"] = [r[0] for r in rows]
    except Exception:
        ws["all_datasets"] = []
    return ws


@router.put("/api/workspaces")
def save_workspaces_route(payload: WorkspacesPayload):
    """Save the entire workspaces config."""
    set_workspaces({"active": payload.active, "workspaces": payload.workspaces})
    return {"status": "ok"}


@router.post("/api/workspaces/active")
def set_active_route(payload: ActivePayload):
    """Set the active workspace only."""
    set_active_workspace(payload.name)
    return {"status": "ok"}
