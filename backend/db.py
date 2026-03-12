import duckdb
import threading

_conn = None
_lock = threading.Lock()


def get_conn() -> duckdb.DuckDBPyConnection:
    """Return the singleton DuckDB connection."""
    global _conn
    if _conn is None:
        raise RuntimeError("Database not initialised. Call init_db() first.")
    return _conn


def init_db() -> duckdb.DuckDBPyConnection:
    """Create the DuckDB connection and the backlinks view."""
    global _conn
    with _lock:
        if _conn is None:
            _conn = duckdb.connect(database=":memory:", read_only=False)
            refresh_views()
    return _conn


def refresh_views() -> None:
    """(Re)create the backlinks view from parquet files in ./store/."""
    global _conn
    if _conn is None:
        raise RuntimeError("Database not initialised. Call init_db() first.")
    _conn.execute(
        "CREATE OR REPLACE VIEW backlinks AS "
        "SELECT * FROM read_parquet('./store/*.parquet')"
    )
