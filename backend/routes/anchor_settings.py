"""Endpoints for managing anchor categorization settings."""

from fastapi import APIRouter, Query
from pydantic import BaseModel

import anchor_settings
from db import get_conn
from analysis.profile_terms import get_auto_branded_terms, invalidate_cache
from analysis.anchors import invalidate_generic_cache

router = APIRouter()


class ProfileSettingsBody(BaseModel):
    branded_terms: list[str]


class GlobalSettingsBody(BaseModel):
    generic_anchors: list[str]
    target_keywords: list[str]


@router.get("/api/anchor-settings")
def read_settings(profile: str = Query(...)):
    """Return current anchor categorization settings for a profile."""
    conn = get_conn()
    ps = anchor_settings.get_profile_settings(profile)
    gs = anchor_settings.get_global_settings()
    auto = get_auto_branded_terms(profile, conn)

    # Fall back to config.yaml if settings file has no data yet
    if not ps["branded_terms"]:
        from config import get_config

        cfg = get_config()
        profile_cfg = cfg.get("profiles", {}).get(profile, {})
        if profile_cfg:
            ps["branded_terms"] = [t.lower() for t in profile_cfg.get("branded_terms", [])]
        else:
            global_cfg = cfg.get("anchor_categories", {})
            ps["branded_terms"] = [t.lower() for t in global_cfg.get("branded_terms", [])]

    if not gs["target_keywords"]:
        from config import get_config

        cfg = get_config()
        gs["target_keywords"] = [kw.lower() for kw in cfg.get("anchor_categories", {}).get("target_keywords", [])]

    if not gs["generic_anchors"]:
        from config import get_config

        cfg = get_config()
        gs["generic_anchors"] = [g.lower() for g in cfg.get("anchor_categories", {}).get("generic_anchors", [])]

    return {
        "branded_terms": ps["branded_terms"],
        "target_keywords": gs["target_keywords"],
        "generic_anchors": gs["generic_anchors"],
        "auto_branded_terms": auto,
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

    profiles = {}
    for p in profiles_list:
        ps = anchor_settings.get_profile_settings(p)
        auto = get_auto_branded_terms(p, conn)

        # Fall back to config.yaml
        if not ps["branded_terms"]:
            from config import get_config

            cfg = get_config()
            profile_cfg = cfg.get("profiles", {}).get(p, {})
            if profile_cfg:
                ps["branded_terms"] = [t.lower() for t in profile_cfg.get("branded_terms", [])]
            else:
                global_cfg = cfg.get("anchor_categories", {})
                ps["branded_terms"] = [t.lower() for t in global_cfg.get("branded_terms", [])]

        profiles[p] = {
            "branded_terms": ps["branded_terms"],
            "auto_branded_terms": auto,
        }

    gs = anchor_settings.get_global_settings()

    if not gs["target_keywords"]:
        from config import get_config

        cfg = get_config()
        gs["target_keywords"] = [kw.lower() for kw in cfg.get("anchor_categories", {}).get("target_keywords", [])]

    if not gs["generic_anchors"]:
        from config import get_config

        cfg = get_config()
        gs["generic_anchors"] = [g.lower() for g in cfg.get("anchor_categories", {}).get("generic_anchors", [])]

    return {
        "profiles": profiles,
        "target_keywords": gs["target_keywords"],
        "generic_anchors": gs["generic_anchors"],
    }


@router.post("/api/anchor-settings/profile")
def write_profile_settings(body: ProfileSettingsBody, profile: str = Query(...)):
    """Save branded terms for a profile."""
    anchor_settings.set_profile_settings(profile, body.branded_terms)
    invalidate_cache(profile)
    return {"status": "ok"}


@router.post("/api/anchor-settings/global")
def write_global_settings(body: GlobalSettingsBody):
    """Save global target keywords and generic anchors."""
    anchor_settings.set_global_settings(body.generic_anchors, body.target_keywords)
    invalidate_generic_cache()
    # Invalidate all profile caches since target keywords affect categorization
    invalidate_cache()
    return {"status": "ok"}
