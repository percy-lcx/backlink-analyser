"""Shared text filter helper for DuckDB queries."""


def apply_text_filter(
    conditions: list[str],
    params: list,
    idx: int,
    column: str,
    value: str,
    mode: str = "contains",
    exclude: bool = False,
) -> int:
    """Append a text filter condition and return the next parameter index.

    ``mode`` can be ``"exact"``, ``"contains"``, or ``"regex"``.
    """
    if mode == "exact":
        op = "!=" if exclude else "="
        conditions.append(f"{column} {op} ${idx}")
        params.append(value)
    elif mode == "regex":
        if exclude:
            conditions.append(f"NOT regexp_matches({column}, ${idx})")
        else:
            conditions.append(f"regexp_matches({column}, ${idx})")
        params.append(value)
    else:  # contains (default)
        op = "NOT ILIKE" if exclude else "ILIKE"
        conditions.append(f"{column} {op} ${idx}")
        params.append(f"%{value}%")
    return idx + 1
