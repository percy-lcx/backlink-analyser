"""Endpoints for managing anchor categorization settings."""

from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

import anchor_settings
from db import get_conn
from analysis.profile_terms import get_auto_branded_terms, invalidate_cache

router = APIRouter()


class ProfileSettingsBody(BaseModel):
    branded_terms: list[str]
    excluded_auto_terms: list[str] = []
    target_keywords: Optional[list[str]] = None
    generic_anchors: Optional[list[str]] = None


class GlobalSettingsBody(BaseModel):
    generic_anchors: list[str]
    target_keywords: list[str]


def _effective_global(gs: dict) -> dict:
    """Fill empty global settings from config.yaml fallback."""
    if not gs["target_keywords"]:
        from config import get_config
        cfg = get_config()
        gs["target_keywords"] = [kw.lower() for kw in cfg.get("anchor_categories", {}).get("target_keywords", [])]
    if not gs["generic_anchors"]:
        from config import get_config
        cfg = get_config()
        gs["generic_anchors"] = [g.lower() for g in cfg.get("anchor_categories", {}).get("generic_anchors", [])]
    return gs


@router.get("/api/anchor-settings")
def read_settings(profile: str = Query(...)):
    """Return current anchor categorization settings for a profile."""
    conn = get_conn()
    ps = anchor_settings.get_profile_settings(profile)
    gs = anchor_settings.get_global_settings()
    gs = _effective_global(gs)

    auto = get_auto_branded_terms(profile, conn)
    excluded_set = set(ps.get("excluded_auto_terms", []))
    auto = [t for t in auto if t not in excluded_set]

    # Fall back to config.yaml profile section if settings file has no data yet
    if not ps["branded_terms"]:
        from config import get_config
        cfg = get_config()
        profile_cfg = cfg.get("profiles", {}).get(profile, {})
        if profile_cfg:
            ps["branded_terms"] = [t.lower() for t in profile_cfg.get("branded_terms", [])]

    has_custom_kw = ps["target_keywords"] is not None
    has_custom_ga = ps["generic_anchors"] is not None

    return {
        "branded_terms": ps["branded_terms"],
        "target_keywords": ps["target_keywords"] if has_custom_kw else gs["target_keywords"],
        "generic_anchors": ps["generic_anchors"] if has_custom_ga else gs["generic_anchors"],
        "auto_branded_terms": auto,
        "excluded_auto_terms": ps.get("excluded_auto_terms", []),
        "has_custom_target_keywords": has_custom_kw,
        "has_custom_generic_anchors": has_custom_ga,
    }


@router.get("/api/anchor-settings/all")
def read_all_settings():
    """Return branded terms and auto-detected terms for every ingested profile,
    plus global target keywords and generic anchors."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT DISTINCT profile_label FROM backlinks ORDER BY profile_label"
    ).fetchall()
    profiles_list = [r[0] for r in rows]

    gs = anchor_settings.get_global_settings()
    gs = _effective_global(gs)

    profiles = {}
    for p in profiles_list:
        ps = anchor_settings.get_profile_settings(p)
        auto = get_auto_branded_terms(p, conn)
        excluded_set = set(ps.get("excluded_auto_terms", []))
        auto = [t for t in auto if t not in excluded_set]

        # Fall back to config.yaml profile section
        if not ps["branded_terms"]:
            from config import get_config
            cfg = get_config()
            profile_cfg = cfg.get("profiles", {}).get(p, {})
            if profile_cfg:
                ps["branded_terms"] = [t.lower() for t in profile_cfg.get("branded_terms", [])]

        has_custom_kw = ps["target_keywords"] is not None
        has_custom_ga = ps["generic_anchors"] is not None

        profiles[p] = {
            "branded_terms": ps["branded_terms"],
            "auto_branded_terms": auto,
            "excluded_auto_terms": ps.get("excluded_auto_terms", []),
            "target_keywords": ps["target_keywords"] if has_custom_kw else gs["target_keywords"],
            "generic_anchors": ps["generic_anchors"] if has_custom_ga else gs["generic_anchors"],
            "has_custom_target_keywords": has_custom_kw,
            "has_custom_generic_anchors": has_custom_ga,
        }

    return {
        "profiles": profiles,
        "target_keywords": gs["target_keywords"],
        "generic_anchors": gs["generic_anchors"],
    }


@router.post("/api/anchor-settings/profile")
def write_profile_settings(body: ProfileSettingsBody, profile: str = Query(...)):
    """Save branded terms (and optionally target keywords / generic anchors) for a profile."""
    anchor_settings.set_profile_settings(
        profile,
        body.branded_terms,
        body.excluded_auto_terms,
        target_keywords=body.target_keywords,
        generic_anchors=body.generic_anchors,
    )
    invalidate_cache(profile)
    return {"status": "ok"}


@router.post("/api/anchor-settings/global")
def write_global_settings(body: GlobalSettingsBody):
    """Save global target keywords and generic anchors."""
    anchor_settings.set_global_settings(body.generic_anchors, body.target_keywords)
    # Invalidate all profile caches since target keywords affect categorization
    invalidate_cache()
    return {"status": "ok"}
