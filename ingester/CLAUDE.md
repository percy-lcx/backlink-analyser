# Ingester - Rust CLI

Parses CSV/TSV backlink exports into Parquet files using Polars.

## Stack

Rust 2021, Polars (parquet + lazy + datetime), Clap, Rayon, CSV. See `Cargo.toml` for full deps.

## Structure

- `src/main.rs` - CLI args (Clap), file discovery, orchestration
- `src/parser/` - Format-specific parsers
  - `ahrefs.rs` - Primary parser (fully implemented)
  - `semrush.rs` - Stub for future Semrush support
  - `detector.rs` - Auto-detects file format and encoding
- `src/normalize.rs` - `BacklinkRecord` struct (40+ fields), field normalization, URL extraction
- `src/writer.rs` - Polars DataFrame construction, deduplication, Parquet output

## Data Flow

1. Scans `--source` directory for `*.csv` / `*.tsv` files recursively
2. Filename becomes the profile label
3. Detects format (Ahrefs vs Semrush) and encoding, parses accordingly
4. Normalizes fields into `BacklinkRecord`, builds Polars DataFrame
5. Deduplicates and merges with existing data, writes Parquet to `--output`

## Build & Run

```
cargo build --release
# Binary at target/release/backlink-ingest

cargo run --release -- --source ../data --output ../store
```

## Notes

- Release profile uses opt-level 3 and LTO for performance
- Handles non-UTF-8 files via chardetng + encoding_rs
- Currently only Ahrefs format is fully implemented
