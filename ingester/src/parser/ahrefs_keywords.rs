use crate::normalize::{extract_domain_and_path, OrganicKeywordRecord};
use crate::parser::detector::Delimiter;
use anyhow::Result;
use chrono::NaiveDateTime;
use std::collections::HashMap;
use std::path::Path;

fn parse_bool(val: &str) -> bool {
    let v = val.to_lowercase();
    let v = v.trim();
    !v.is_empty() && !matches!(v, "false" | "f" | "no" | "n" | "0")
}

fn parse_f32(val: &str) -> f32 {
    val.trim().parse().unwrap_or(0.0)
}

fn parse_u32(val: &str) -> u32 {
    val.trim().parse().unwrap_or(0)
}

fn parse_u64(val: &str) -> u64 {
    val.trim().parse().unwrap_or(0)
}

fn parse_datetime(val: &str) -> Option<NaiveDateTime> {
    let val = val.trim();
    if val.is_empty() {
        return None;
    }
    NaiveDateTime::parse_from_str(val, "%Y-%m-%dT%H:%M:%S")
        .or_else(|_| NaiveDateTime::parse_from_str(val, "%Y-%m-%d %H:%M:%S"))
        .or_else(|_| NaiveDateTime::parse_from_str(val, "%m/%d/%Y %H:%M"))
        .or_else(|_| {
            chrono::NaiveDate::parse_from_str(val, "%Y-%m-%d")
                .map(|d| d.and_hms_opt(0, 0, 0).unwrap())
        })
        .ok()
}

fn default_datetime() -> NaiveDateTime {
    NaiveDateTime::parse_from_str("1970-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
}

struct KeywordColumns {
    keyword: Option<usize>,
    country_code: Option<usize>,
    location: Option<usize>,
    language: Option<usize>,
    entities: Option<usize>,
    serp_features: Option<usize>,
    volume: Option<usize>,
    kd: Option<usize>,
    cpc: Option<usize>,
    organic_traffic: Option<usize>,
    paid_traffic: Option<usize>,
    current_position: Option<usize>,
    current_url: Option<usize>,
    current_url_inside: Option<usize>,
    updated: Option<usize>,
    navigational: Option<usize>,
    informational: Option<usize>,
    commercial: Option<usize>,
    transactional: Option<usize>,
    branded: Option<usize>,
    local: Option<usize>,
}

impl KeywordColumns {
    fn from_headers(headers: &csv::StringRecord) -> Self {
        let header_map: HashMap<String, usize> = headers
            .iter()
            .enumerate()
            .map(|(i, h)| (h.trim().trim_matches('"').to_lowercase(), i))
            .collect();
        let find = |name: &str| -> Option<usize> {
            header_map.get(&name.to_lowercase()).copied()
        };

        KeywordColumns {
            keyword: find("keyword"),
            country_code: find("country code"),
            location: find("location"),
            language: find("language"),
            entities: find("entities"),
            serp_features: find("serp features"),
            volume: find("volume"),
            kd: find("kd"),
            cpc: find("cpc"),
            organic_traffic: find("organic traffic"),
            paid_traffic: find("paid traffic"),
            current_position: find("current position"),
            current_url: find("current url"),
            current_url_inside: find("current url inside"),
            updated: find("updated"),
            navigational: find("navigational"),
            informational: find("informational"),
            commercial: find("commercial"),
            transactional: find("transactional"),
            branded: find("branded"),
            local: find("local"),
        }
    }

    fn get<'a>(&self, record: &'a csv::StringRecord, col: Option<usize>) -> &'a str {
        col.and_then(|i| record.get(i)).unwrap_or("")
    }
}

pub fn parse_ahrefs_keywords_file(
    path: &Path,
    delimiter: Delimiter,
    profile_label: &str,
) -> Result<Vec<OrganicKeywordRecord>> {
    let delim_byte = match delimiter {
        Delimiter::Tab => b'\t',
        Delimiter::Comma => b',',
    };

    let content = crate::parser::detector::read_file_to_string(path)?;

    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(delim_byte)
        .has_headers(true)
        .flexible(true)
        .quoting(true)
        .from_reader(content.as_bytes());

    let headers = rdr.headers()?.clone();
    let cols = KeywordColumns::from_headers(&headers);
    let source_file = path
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();

    let mut records = Vec::new();

    for result in rdr.records() {
        let row = match result {
            Ok(r) => r,
            Err(_) => continue,
        };

        let current_url = cols.get(&row, cols.current_url).to_string();
        let (current_url_domain, current_url_path) = extract_domain_and_path(&current_url);

        let updated_str = cols.get(&row, cols.updated);

        records.push(OrganicKeywordRecord {
            keyword: cols.get(&row, cols.keyword).to_string(),
            country_code: cols.get(&row, cols.country_code).to_string(),
            location: cols.get(&row, cols.location).to_string(),
            language: cols.get(&row, cols.language).to_string(),
            entities: cols.get(&row, cols.entities).to_string(),
            serp_features: cols.get(&row, cols.serp_features).to_string(),
            volume: parse_u32(cols.get(&row, cols.volume)),
            kd: parse_u32(cols.get(&row, cols.kd)),
            cpc: parse_f32(cols.get(&row, cols.cpc)),
            organic_traffic: parse_u64(cols.get(&row, cols.organic_traffic)),
            paid_traffic: parse_u64(cols.get(&row, cols.paid_traffic)),
            current_position: parse_u32(cols.get(&row, cols.current_position)),
            current_url,
            current_url_domain,
            current_url_path,
            current_url_inside: cols.get(&row, cols.current_url_inside).to_string(),
            updated: parse_datetime(updated_str).unwrap_or_else(default_datetime),
            is_navigational: parse_bool(cols.get(&row, cols.navigational)),
            is_informational: parse_bool(cols.get(&row, cols.informational)),
            is_commercial: parse_bool(cols.get(&row, cols.commercial)),
            is_transactional: parse_bool(cols.get(&row, cols.transactional)),
            is_branded: parse_bool(cols.get(&row, cols.branded)),
            is_local: parse_bool(cols.get(&row, cols.local)),
            source_file: source_file.clone(),
            profile_label: profile_label.to_string(),
        });
    }

    Ok(records)
}
