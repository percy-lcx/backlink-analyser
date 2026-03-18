mod normalize;
mod parser;
mod writer;

use anyhow::Result;
use clap::Parser as ClapParser;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

#[derive(ClapParser)]
#[command(name = "backlink-ingest", about = "Ingest backlink CSVs/TSVs into parquet")]
struct Cli {
    #[arg(long, default_value = "./data/")]
    source: PathBuf,

    #[arg(long, default_value = "./store/")]
    output: PathBuf,

    /// Specific file(s) to ingest. If omitted, all CSV/TSV files in --source are ingested.
    #[arg(long, num_args = 1..)]
    files: Vec<PathBuf>,
}

fn derive_profile_label(path: &Path) -> String {
    path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

fn collect_input_files(source: &Path) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut files = Vec::new();
    for ext in &["csv", "tsv", "CSV", "TSV"] {
        for pattern_str in &[
            format!("{}/**/*.{}", source.display(), ext),
            format!("{}/*.{}", source.display(), ext),
        ] {
            if let Ok(paths) = glob::glob(pattern_str) {
                for entry in paths.flatten() {
                    if seen.insert(entry.clone()) {
                        files.push(entry);
                    }
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

    let files = if cli.files.is_empty() {
        collect_input_files(&cli.source)
    } else {
        cli.files.clone()
    };
    if files.is_empty() {
        println!("No CSV/TSV files found in {}", cli.source.display());
        return Ok(());
    }

    println!("Found {} file(s)", files.len());

    // Group records by profile_label, separated by data type
    let mut backlink_grouped: HashMap<String, Vec<normalize::BacklinkRecord>> = HashMap::new();
    let mut keyword_grouped: HashMap<String, Vec<normalize::OrganicKeywordRecord>> = HashMap::new();

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

        match detected.data_type {
            parser::detector::DataType::Backlinks => {
                let records = parser::ahrefs::parse_ahrefs_file(file, detected.delimiter, &profile_label)?;
                println!("    Parsed {} backlink records (format: {:?})", records.len(), detected.source);
                backlink_grouped.entry(profile_label).or_default().extend(records);
            }
            parser::detector::DataType::OrganicKeywords => {
                let records = parser::ahrefs_keywords::parse_ahrefs_keywords_file(file, detected.delimiter, &profile_label)?;
                println!("    Parsed {} keyword records (format: {:?})", records.len(), detected.source);
                keyword_grouped.entry(profile_label).or_default().extend(records);
            }
        }
    }

    // Write backlink parquet per profile
    std::fs::create_dir_all(&cli.output)?;

    for (label, records) in &backlink_grouped {
        let output_path = cli.output.join(format!("{}.parquet", label));
        println!("  Writing {} backlink records to {}", records.len(), output_path.display());
        writer::write_parquet(records, &output_path)?;
    }

    // Write keyword parquet per profile to keywords/ subdirectory
    let keywords_output = cli.output.join("keywords");
    if !keyword_grouped.is_empty() {
        std::fs::create_dir_all(&keywords_output)?;
    }

    for (label, records) in &keyword_grouped {
        let output_path = keywords_output.join(format!("{}.parquet", label));
        println!("  Writing {} keyword records to {}", records.len(), output_path.display());
        writer::write_keywords_parquet(records, &output_path)?;
    }

    println!("Done!");
    Ok(())
}
