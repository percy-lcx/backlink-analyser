def velocity_sql(
    date_column: str,
    interval: str = "week",
    count_alias: str = "cnt",
) -> str:
    """Return a SQL fragment that groups a date column by the given interval.

    Args:
        date_column: The column name containing the date.
        interval: 'week' or 'month'.
        count_alias: Alias for the count column.

    Returns:
        A SQL string like:
          DATE_TRUNC('week', first_seen) AS period, COUNT(*) AS cnt
    """
    if interval not in ("week", "month"):
        interval = "week"
    return (
        f"DATE_TRUNC('{interval}', {date_column}) AS period, "
        f"COUNT(*) AS {count_alias}"
    )


def velocity_group_sql(interval: str = "week") -> str:
    """Return the GROUP BY / ORDER BY clause for velocity queries."""
    return "GROUP BY period ORDER BY period"
