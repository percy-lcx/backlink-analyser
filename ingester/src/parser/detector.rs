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

/// Read the raw bytes of a file and decode to UTF-8, handling non-UTF-8 encodings automatically.
pub fn read_file_to_string(path: &Path) -> Result<String> {
    let raw = std::fs::read(path)?;

    // Try UTF-8 first (fast path)
    if let Ok(s) = std::str::from_utf8(&raw) {
        return Ok(s.to_string());
    }

    // Auto-detect encoding and convert
    let (encoding, _confident) = encoding_rs::Encoding::for_bom(&raw)
        .map(|(enc, _)| (enc, true))
        .unwrap_or_else(|| {
            // Sniff encoding from content — try common CSV encodings
            let mut detector = chardetng::EncodingDetector::new();
            detector.feed(&raw[..raw.len().min(8192)], true);
            (detector.guess(None, true), false)
        });

    let (decoded, _, had_errors) = encoding.decode(&raw);
    if had_errors {
        // Fallback: force decode as Windows-1252 (very common for European CSVs)
        let (decoded, _, _) = encoding_rs::WINDOWS_1252.decode(&raw);
        eprintln!(
            "  Note: converted {} from Windows-1252 to UTF-8",
            path.display()
        );
        Ok(decoded.into_owned())
    } else {
        eprintln!(
            "  Note: converted {} from {} to UTF-8",
            path.display(),
            encoding.name()
        );
        Ok(decoded.into_owned())
    }
}

pub fn detect_format(path: &Path) -> Result<DetectedFormat> {
    let content = read_file_to_string(path)?;
    let header = content.lines().next().unwrap_or("").trim();

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
