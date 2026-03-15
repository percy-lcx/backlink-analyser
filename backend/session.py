"""In-memory session store for persisting filter state across requests."""

import uuid
from typing import Any

from fastapi import Request, Response

# session_id -> { (profile, tab) -> { filter_key: filter_value } }
_sessions: dict[str, dict[tuple[str, str], dict[str, Any]]] = {}

_COOKIE_NAME = "session_id"
_MAX_AGE = 86400  # 24 hours


def get_or_create_session(request: Request, response: Response) -> str:
    """Read session ID from cookie, or create a new one."""
    session_id = request.cookies.get(_COOKIE_NAME)
    if session_id and session_id in _sessions:
        return session_id
    session_id = uuid.uuid4().hex
    _sessions[session_id] = {}
    response.set_cookie(
        key=_COOKIE_NAME,
        value=session_id,
        max_age=_MAX_AGE,
        path="/",
        samesite="lax",
        httponly=True,
    )
    return session_id


def get_filters(session_id: str, profile: str, tab: str) -> dict[str, Any]:
    """Return saved filter dict for a profile+tab, or empty dict."""
    store = _sessions.get(session_id, {})
    return dict(store.get((profile, tab), {}))


def set_filters(
    session_id: str, profile: str, tab: str, filters: dict[str, Any]
) -> None:
    """Save filter state for a profile+tab."""
    if session_id not in _sessions:
        _sessions[session_id] = {}
    _sessions[session_id][(profile, tab)] = dict(filters)
