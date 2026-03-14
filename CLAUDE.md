# Backlink Analyser

SEO backlink analysis platform. Ingests CSV/TSV exports from Ahrefs (Semrush planned), stores as Parquet, queries via DuckDB, displays in React.

## Architecture

```
CSV/TSV files (./data/) → Rust Ingester → Parquet (./store/) → FastAPI + DuckDB → React UI
```

Three components in subdirectories, each with its own CLAUDE.md:
- `ingester/` - Rust CLI that parses CSV/TSV into Parquet
- `backend/` - Python FastAPI serving DuckDB queries over Parquet
- `frontend/` - React + TypeScript + Vite dashboard

## Key Files

- `config.yaml` - Page/anchor categorization rules and thresholds used by backend
- `cli.py` - CLI entry point: `python cli.py ingest` and `python cli.py serve`
- `run.py` - Dev launcher that starts both backend (port 8000) and frontend (port 5173)

## Dev Commands

```
# Start everything (backend + frontend)
python run.py

# Backend only
python cli.py serve --reload

# Frontend only
cd frontend && npm run dev

# Build ingester
cd ingester && cargo build --release

# Run ingestion
python cli.py ingest
```

## Data Flow

1. Place CSV/TSV exports in `./data/` (filename becomes the profile label)
2. Run ingester to produce Parquet files in `./store/`
3. Backend creates an in-memory DuckDB view over all Parquet files on startup
4. Frontend proxies `/api/*` requests to backend via Vite dev server
5. POST `/api/ingest` triggers ingestion and refreshes DuckDB views without restart

## Notes

- No test frameworks exist yet in any component
- DuckDB runs in-memory; restarting backend re-reads from `./store/*.parquet`
- The ingester binary path is `ingester/target/release/backlink-ingest`
