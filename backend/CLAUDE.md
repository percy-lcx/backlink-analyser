# Backend - FastAPI + DuckDB

Python API layer that queries Parquet data via in-memory DuckDB.

## Stack

FastAPI, Uvicorn, DuckDB, PyYAML. Dependencies in `requirements.txt`.

## Structure

- `main.py` - App setup, lifespan (calls `init_db`), CORS, router registration, `/api/ingest` endpoint
- `db.py` - DuckDB connection management; `get_conn()` returns connection, `refresh_views()` rebuilds the backlinks view
- `config.py` - Loads `../config.yaml` once, accessed via `get_config()`
- `routes/` - 12 route modules, each exports a `router`. All endpoints prefixed `/api/`
- `analysis/` - Reusable analysis logic (categories, anchors, velocity, redirects)

## Patterns

- Routes get a DuckDB connection via `get_conn()`, run SQL, return dicts directly
- Raw SQL against the `backlinks` view (no ORM)
- Config-driven categorization: page and anchor categories come from `../config.yaml`
- All routes are synchronous (DuckDB is not async)

## Run

```
# From project root
python cli.py serve --reload
# Or directly
python -m uvicorn backend.main:app --reload
```

## API Docs

FastAPI auto-generates docs at http://localhost:8000/docs when running.
