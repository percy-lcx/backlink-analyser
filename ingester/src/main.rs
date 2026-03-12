mod normalize;
mod parser;
mod writer;

use anyhow::Result;
use clap::Parser as ClapParser;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(ClapParser)]
#[command(name = "backlink-ingest", about = "Ingest backlink CSVs/TSVs into parquet")]
struct Cli {
    #[arg(long, default_value = "./data/")]
    source: PathBuf,

    #[arg(long, default_value = "./store/")]
    output: PathBuf,
}

fn derive_profile_label(path: &Path) -> String {
    path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

fn collect_input_files(source: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    for ext in &["csv", "tsv", "CSV", "TSV"] {
        let pattern = format!("{}/**/*.{}", source.display(), ext);
        if let Ok(paths) = glob::glob(&pattern) {
            for entry in paths.flatten() {
                files.push(entry);
            }
        }
        // Also check flat directory
        let pattern = format!("{}/*.{}", source.display(), ext);
        if let Ok(paths) = glob::glob(&pattern) {
            for entry in paths.flatten() {
                if !files.contains(&entry) {
                    files.push(entry);
                }
            }
        }
    }
    files
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    println!("Backlink Ingest");
    println!("  Source: {}", cli.source.display());
    println!("  Output: {}", cli.output.display());

    let files = collect_input_files(&cli.source);
    if files.is_empty() {
        println!("No CSV/TSV files found in {}", cli.source.display());
        return Ok(());
    }

    println!("Found {} file(s)", files.len());

    // Group records by profile_label
    let mut grouped: HashMap<String, Vec<normalize::BacklinkRecord>> = HashMap::new();

    for file in &files {
        println!("  Processing: {}", file.display());

        let detected = match parser::detector::detect_format(file) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("  Skipping {}: {}", file.display(), e);
                continue;
            }
        };

        let profile_label = derive_profile_label(file);

        let records = match detected.source {
            parser::detector::SourceFormat::Ahrefs => {
                parser::ahrefs::parse_ahrefs_file(file, detected.delimiter, &profile_label)?
            }
        };

        println!("    Parsed {} records (format: {:?})", records.len(), detected.source);

        grouped
            .entry(profile_label)
            .or_default()
            .extend(records);
    }

    // Write parquet per profile
    std::fs::create_dir_all(&cli.output)?;

    for (label, records) in &grouped {
        let output_path = cli.output.join(format!("{}.parquet", label));
        println!("  Writing {} records to {}", records.len(), output_path.display());
        writer::write_parquet(records, &output_path)?;
    }

    println!("Done!");
    Ok(())
}
