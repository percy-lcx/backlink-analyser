use anyhow::{Result, bail};
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SourceFormat {
    Ahrefs,
    // Semrush, // stub for future
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Delimiter {
    Comma,
    Tab,
}

pub struct DetectedFormat {
    pub source: SourceFormat,
    pub delimiter: Delimiter,
}

pub fn detect_format(path: &Path) -> Result<DetectedFormat> {
    let mut buf = String::new();
    let file = std::fs::File::open(path)?;
    let mut reader = std::io::BufReader::new(file);
    std::io::BufRead::read_line(&mut reader, &mut buf)?;

    let header = buf.trim();

    // Auto-detect delimiter
    let delimiter = if header.contains('\t') {
        Delimiter::Tab
    } else {
        Delimiter::Comma
    };

    // Detect source format from headers
    let lower = header.to_lowercase();
    if lower.contains("referring page title") || lower.starts_with("\"referring page title") {
        Ok(DetectedFormat {
            source: SourceFormat::Ahrefs,
            delimiter,
        })
    } else {
        bail!(
            "Unknown format in {}: header starts with '{}'",
            path.display(),
            &header[..header.len().min(60)]
        )
    }
}
