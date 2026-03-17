use chrono::NaiveDateTime;
use url::Url;

#[derive(Debug, Clone)]
pub struct BacklinkRecord {
    pub referring_page_title: String,
    pub referring_url: String,
    pub referring_domain: String,
    pub language: String,
    pub platform: String,
    pub http_code: u16,
    pub domain_rating: f32,
    pub url_rating: f32,
    pub domain_traffic: u64,
    pub referring_domains: u32,
    pub linked_domains: u32,
    pub external_links: u32,
    pub page_traffic: u64,
    pub keywords: u32,
    pub target_url: String,
    pub target_domain: String,
    pub target_path: String,
    pub left_context: String,
    pub anchor: String,
    pub right_context: String,
    pub redirect_chain_urls: String,
    pub redirect_chain_codes: String,
    pub link_type: String,
    pub is_spam: bool,
    pub is_content: bool,
    pub is_nofollow: bool,
    pub is_ugc: bool,
    pub is_sponsored: bool,
    pub is_rendered: bool,
    pub is_raw: bool,
    pub drop_reason: String,
    pub discovered_status: String,
    pub first_seen: NaiveDateTime,
    pub last_seen: NaiveDateTime,
    pub author: String,
    pub page_type: String,
    pub page_category: String,
    pub links_in_group: u32,
    pub source_file: String,
    pub profile_label: String,
}

pub fn extract_domain(url_str: &str) -> String {
    Url::parse(url_str)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_string()))
        .unwrap_or_default()
}

#[derive(Debug, Clone)]
pub struct OrganicKeywordRecord {
    pub keyword: String,
    pub country_code: String,
    pub location: String,
    pub language: String,
    pub entities: String,
    pub serp_features: String,
    pub volume: u32,
    pub kd: u32,
    pub cpc: f32,
    pub organic_traffic: u64,
    pub paid_traffic: u64,
    pub current_position: u32,
    pub current_url: String,
    pub current_url_domain: String,
    pub current_url_path: String,
    pub current_url_inside: String,
    pub updated: NaiveDateTime,
    pub is_navigational: bool,
    pub is_informational: bool,
    pub is_commercial: bool,
    pub is_transactional: bool,
    pub is_branded: bool,
    pub is_local: bool,
    pub source_file: String,
    pub profile_label: String,
}

pub fn extract_domain_and_path(url_str: &str) -> (String, String) {
    match Url::parse(url_str) {
        Ok(u) => (
            u.host_str().unwrap_or("").to_string(),
            u.path().to_string(),
        ),
        Err(_) => (String::new(), String::new()),
    }
}
