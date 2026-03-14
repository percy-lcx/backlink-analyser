use crate::normalize::{extract_domain, extract_domain_and_path, BacklinkRecord};
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

fn parse_u16(val: &str) -> u16 {
    val.trim().parse().unwrap_or(0)
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
    // Try common Ahrefs formats
    NaiveDateTime::parse_from_str(val, "%Y-%m-%dT%H:%M:%S")
        .or_else(|_| NaiveDateTime::parse_from_str(val, "%Y-%m-%d %H:%M:%S"))
        .or_else(|_| {
            chrono::NaiveDate::parse_from_str(val, "%Y-%m-%d")
                .map(|d| d.and_hms_opt(0, 0, 0).unwrap())
        })
        .ok()
}

fn default_datetime() -> NaiveDateTime {
    NaiveDateTime::parse_from_str("1970-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").unwrap()
}

/// Map Ahrefs header names to column indices
struct AhrefsColumns {
    referring_page_title: Option<usize>,
    referring_url: Option<usize>,
    language: Option<usize>,
    platform: Option<usize>,
    http_code: Option<usize>,
    domain_rating: Option<usize>,
    url_rating: Option<usize>,
    domain_traffic: Option<usize>,
    referring_domains: Option<usize>,
    linked_domains: Option<usize>,
    external_links: Option<usize>,
    page_traffic: Option<usize>,
    keywords: Option<usize>,
    target_url: Option<usize>,
    left_context: Option<usize>,
    anchor: Option<usize>,
    right_context: Option<usize>,
    redirect_chain_urls: Option<usize>,
    redirect_chain_codes: Option<usize>,
    link_type: Option<usize>,
    is_spam: Option<usize>,
    is_content: Option<usize>,
    is_nofollow: Option<usize>,
    is_ugc: Option<usize>,
    is_sponsored: Option<usize>,
    is_rendered: Option<usize>,
    is_raw: Option<usize>,
    lost_status: Option<usize>,
    drop_reason: Option<usize>,
    discovered_status: Option<usize>,
    first_seen: Option<usize>,
    last_seen: Option<usize>,
    lost_date: Option<usize>,
    author: Option<usize>,
    page_type: Option<usize>,
    page_category: Option<usize>,
    links_in_group: Option<usize>,
}

impl AhrefsColumns {
    fn from_headers(headers: &csv::StringRecord) -> Self {
        // Build HashMap for O(1) lookups instead of O(h) linear search per column
        let header_map: HashMap<String, usize> = headers
            .iter()
            .enumerate()
            .map(|(i, h)| (h.trim().trim_matches('"').to_lowercase(), i))
            .collect();
        let find = |name: &str| -> Option<usize> {
            header_map.get(&name.to_lowercase()).copied()
        };

        AhrefsColumns {
            referring_page_title: find("Referring page title"),
            referring_url: find("Referring page URL").or_else(|| find("Referring page url")),
            language: find("Language"),
            platform: find("Platform"),
            http_code: find("Referring page HTTP code")
                .or_else(|| find("HTTP code"))
                .or_else(|| find("Status code"))
                .or_else(|| find("HTTP Status")),
            domain_rating: find("Domain rating").or_else(|| find("Domain Rating")),
            url_rating: find("URL rating").or_else(|| find("URL Rating").or_else(|| find("UR"))),
            domain_traffic: find("Domain traffic").or_else(|| find("Domain organic traffic")),
            referring_domains: find("Referring domains"),
            linked_domains: find("Linked domains"),
            external_links: find("External links"),
            page_traffic: find("Page traffic").or_else(|| find("Organic traffic")),
            keywords: find("Keywords"),
            target_url: find("Target URL").or_else(|| find("Target url")),
            left_context: find("Left context"),
            anchor: find("Anchor"),
            right_context: find("Right context"),
            redirect_chain_urls: find("Redirect chain URL")
                .or_else(|| find("Redirect chain")),
            redirect_chain_codes: find("Redirect chain status codes")
                .or_else(|| find("Redirect chain codes")),
            link_type: find("Type").or_else(|| find("Link type")),
            is_spam: find("Spam").or_else(|| find("Is spam")),
            is_content: find("Content").or_else(|| find("Is content")),
            is_nofollow: find("Nofollow").or_else(|| find("Is nofollow")),
            is_ugc: find("UGC").or_else(|| find("Is ugc")),
            is_sponsored: find("Sponsored").or_else(|| find("Is sponsored")),
            is_rendered: find("Rendered").or_else(|| find("Is rendered")),
            is_raw: find("Raw").or_else(|| find("Is raw")),
            lost_status: find("Lost status"),
            drop_reason: find("Drop reason"),
            discovered_status: find("Discovered status"),
            first_seen: find("First seen"),
            last_seen: find("Last seen"),
            lost_date: find("Lost date"),
            author: find("Author"),
            page_type: find("Page type"),
            page_category: find("Page category"),
            links_in_group: find("Links in group").or_else(|| find("Group size")),
        }
    }

    fn get<'a>(&self, record: &'a csv::StringRecord, col: Option<usize>) -> &'a str {
        col.and_then(|i| record.get(i)).unwrap_or("")
    }
}

pub fn parse_ahrefs_file(
    path: &Path,
    delimiter: Delimiter,
    profile_label: &str,
) -> Result<Vec<BacklinkRecord>> {
    let delim_byte = match delimiter {
        Delimiter::Tab => b'\t',
        Delimiter::Comma => b',',
    };

    // Read file content with automatic encoding conversion
    let content = crate::parser::detector::read_file_to_string(path)?;

    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(delim_byte)
        .has_headers(true)
        .flexible(true)
        .quoting(true)
        .from_reader(content.as_bytes());

    let headers = rdr.headers()?.clone();
    let cols = AhrefsColumns::from_headers(&headers);
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

        let referring_url = cols.get(&row, cols.referring_url).to_string();
        let target_url = cols.get(&row, cols.target_url).to_string();

        let referring_domain = extract_domain(&referring_url);
        let (target_domain, target_path) = extract_domain_and_path(&target_url);

        let first_seen_str = cols.get(&row, cols.first_seen);
        let last_seen_str = cols.get(&row, cols.last_seen);
        let lost_date_str = cols.get(&row, cols.lost_date);

        records.push(BacklinkRecord {
            referring_page_title: cols.get(&row, cols.referring_page_title).to_string(),
            referring_url,
            referring_domain,
            language: cols.get(&row, cols.language).to_string(),
            platform: cols.get(&row, cols.platform).to_string(),
            http_code: parse_u16(cols.get(&row, cols.http_code)),
            domain_rating: parse_f32(cols.get(&row, cols.domain_rating)),
            url_rating: parse_f32(cols.get(&row, cols.url_rating)),
            domain_traffic: parse_u64(cols.get(&row, cols.domain_traffic)),
            referring_domains: parse_u32(cols.get(&row, cols.referring_domains)),
            linked_domains: parse_u32(cols.get(&row, cols.linked_domains)),
            external_links: parse_u32(cols.get(&row, cols.external_links)),
            page_traffic: parse_u64(cols.get(&row, cols.page_traffic)),
            keywords: parse_u32(cols.get(&row, cols.keywords)),
            target_url: cols.get(&row, cols.target_url).to_string(),
            target_domain,
            target_path,
            left_context: cols.get(&row, cols.left_context).to_string(),
            anchor: cols.get(&row, cols.anchor).to_string(),
            right_context: cols.get(&row, cols.right_context).to_string(),
            redirect_chain_urls: cols.get(&row, cols.redirect_chain_urls).to_string(),
            redirect_chain_codes: cols.get(&row, cols.redirect_chain_codes).to_string(),
            link_type: cols.get(&row, cols.link_type).to_string(),
            is_spam: parse_bool(cols.get(&row, cols.is_spam)),
            is_content: parse_bool(cols.get(&row, cols.is_content)),
            is_nofollow: parse_bool(cols.get(&row, cols.is_nofollow)),
            is_ugc: parse_bool(cols.get(&row, cols.is_ugc)),
            is_sponsored: parse_bool(cols.get(&row, cols.is_sponsored)),
            is_rendered: parse_bool(cols.get(&row, cols.is_rendered)),
            is_raw: parse_bool(cols.get(&row, cols.is_raw)),
            lost_status: cols.get(&row, cols.lost_status).to_string(),
            drop_reason: cols.get(&row, cols.drop_reason).to_string(),
            discovered_status: cols.get(&row, cols.discovered_status).to_string(),
            first_seen: parse_datetime(first_seen_str).unwrap_or_else(default_datetime),
            last_seen: parse_datetime(last_seen_str).unwrap_or_else(default_datetime),
            lost_date: parse_datetime(lost_date_str),
            author: cols.get(&row, cols.author).to_string(),
            page_type: cols.get(&row, cols.page_type).to_string(),
            page_category: cols.get(&row, cols.page_category).to_string(),
            links_in_group: parse_u32(cols.get(&row, cols.links_in_group)),
            source_file: source_file.clone(),
            profile_label: profile_label.to_string(),
        });
    }

    Ok(records)
}
