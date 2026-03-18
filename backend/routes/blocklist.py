"""Endpoints for managing the domain blocklist."""

from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from blocklist import get_blocklist, set_blocklist
from db import get_conn

router = APIRouter()

# ---------------------------------------------------------------------------
# Column whitelists – the ONLY defence against SQL injection for identifiers
# ---------------------------------------------------------------------------

NUMERIC_COLUMNS = frozenset({
    "domain_rating", "url_rating", "domain_traffic", "referring_domains",
    "linked_domains", "external_links", "page_traffic", "keywords",
    "http_code", "links_in_group",
})
BOOLEAN_COLUMNS = frozenset({
    "is_spam", "is_content", "is_nofollow", "is_ugc", "is_sponsored",
    "is_rendered", "is_raw",
})
STRING_COLUMNS = frozenset({
    "referring_page_title", "referring_url", "referring_domain", "language",
    "platform", "target_url", "target_domain", "target_path",
    "left_context", "anchor", "right_context", "link_type", "drop_reason",
    "discovered_status", "author", "page_type", "page_category",
    "source_file", "redirect_chain_urls", "redirect_chain_codes",
})
ALL_COLUMNS = NUMERIC_COLUMNS | BOOLEAN_COLUMNS | STRING_COLUMNS

VALID_NUMERIC_AGGS = {"MAX", "MIN", "AVG"}
VALID_BOOL_AGGS = {"ANY", "ALL"}
VALID_COMPARISON_OPS = {"=", "!=", "<", "<=", ">", ">="}
VALID_STRING_OPS = {"=", "!=", "contains", "not_contains"}

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class SaveBlocklistBody(BaseModel):
    domains: list[str]


class CriterionRule(BaseModel):
    field: str
    aggregation: Optional[str] = None
    operator: str
    value: str

    @field_validator("field")
    @classmethod
    def validate_field(cls, v: str) -> str:
        if v not in ALL_COLUMNS:
            raise ValueError(f"Invalid column: {v}")
        return v


class AutoBlockCriteriaBody(BaseModel):
    combine: Literal["AND", "OR"]
    rules: list[CriterionRule]
    preview: bool = False

# ---------------------------------------------------------------------------
# SQL builder
# ---------------------------------------------------------------------------


def _build_having_clause(rule: CriterionRule, idx: int) -> tuple[str, list, int]:
    """Return (sql_fragment, params, next_param_idx)."""
    field = rule.field  # already validated against whitelist
    params: list = []

    if field in NUMERIC_COLUMNS:
        agg = (rule.aggregation or "MAX").upper()
        if agg not in VALID_NUMERIC_AGGS:
            raise ValueError(f"Invalid aggregation for numeric field: {agg}")
        if rule.operator not in VALID_COMPARISON_OPS:
            raise ValueError(f"Invalid operator for numeric field: {rule.operator}")
        sql = f"{agg}(COALESCE({field}, 0)) {rule.operator} ${idx}"
        params.append(float(rule.value))
        return sql, params, idx + 1

    if field in BOOLEAN_COLUMNS:
        agg = (rule.aggregation or "ANY").upper()
        if agg not in VALID_BOOL_AGGS:
            raise ValueError(f"Invalid aggregation for boolean field: {agg}")
        bool_func = "BOOL_OR" if agg == "ANY" else "BOOL_AND"
        bool_val = rule.value.lower() in ("true", "1", "yes")
        sql = f"{bool_func}({field}) = ${idx}"
        params.append(bool_val)
        return sql, params, idx + 1

    # String columns
    op = rule.operator
    if op not in VALID_STRING_OPS:
        raise ValueError(f"Invalid operator for string field: {op}")

    if op == "contains":
        sql = f"BOOL_OR({field} ILIKE ${idx})"
        params.append(f"%{rule.value}%")
    elif op == "not_contains":
        sql = f"NOT BOOL_OR({field} ILIKE ${idx})"
        params.append(f"%{rule.value}%")
    elif op == "=":
        sql = f"BOOL_OR({field} = ${idx})"
        params.append(rule.value)
    else:  # !=
        sql = f"NOT BOOL_OR({field} = ${idx})"
        params.append(rule.value)
    return sql, params, idx + 1

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/api/blocklist")
def read_blocklist():
    return {"domains": get_blocklist()}


@router.post("/api/blocklist")
def write_blocklist(body: SaveBlocklistBody):
    set_blocklist(body.domains)
    return {"status": "ok"}


@router.get("/api/blocklist/columns")
def get_columns():
    """Return column names grouped by type for the criteria builder UI."""
    return {
        "numeric": sorted(NUMERIC_COLUMNS),
        "boolean": sorted(BOOLEAN_COLUMNS),
        "string": sorted(STRING_COLUMNS),
    }


@router.post("/api/blocklist/auto-block")
def auto_block_criteria(body: AutoBlockCriteriaBody):
    """Auto-block domains matching user-defined criteria across all profiles."""
    if not body.rules:
        raise HTTPException(status_code=400, detail="At least one rule is required")

    all_params: list = []
    having_parts: list[str] = []
    idx = 1

    for rule in body.rules:
        try:
            sql_frag, rule_params, idx = _build_having_clause(rule, idx)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        having_parts.append(f"({sql_frag})")
        all_params.extend(rule_params)

    joiner = " AND " if body.combine == "AND" else " OR "
    having_sql = joiner.join(having_parts)

    query = f"""
        SELECT referring_domain
        FROM backlinks
        GROUP BY referring_domain
        HAVING {having_sql}
    """

    conn = get_conn()
    rows = conn.execute(query, all_params).fetchall()
    matched_domains = {row[0] for row in rows}

    if body.preview:
        return {"matched": len(matched_domains)}

    existing = set(get_blocklist())
    added = matched_domains - existing
    merged = sorted(existing | matched_domains)
    set_blocklist(merged)
    return {"added": len(added), "total": len(merged), "matched": len(matched_domains)}
