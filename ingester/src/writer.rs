use crate::normalize::BacklinkRecord;
use anyhow::Result;
use polars::prelude::*;
use std::path::Path;

pub fn write_parquet(records: &[BacklinkRecord], output_path: &Path) -> Result<()> {
    if records.is_empty() {
        eprintln!("  No records to write for {}", output_path.display());
        return Ok(());
    }

    let len = records.len();

    let referring_page_title: Vec<&str> = records.iter().map(|r| r.referring_page_title.as_str()).collect();
    let referring_url: Vec<&str> = records.iter().map(|r| r.referring_url.as_str()).collect();
    let referring_domain: Vec<&str> = records.iter().map(|r| r.referring_domain.as_str()).collect();
    let language: Vec<&str> = records.iter().map(|r| r.language.as_str()).collect();
    let platform: Vec<&str> = records.iter().map(|r| r.platform.as_str()).collect();
    let http_code: Vec<u32> = records.iter().map(|r| r.http_code as u32).collect();
    let domain_rating: Vec<f32> = records.iter().map(|r| r.domain_rating).collect();
    let url_rating: Vec<f32> = records.iter().map(|r| r.url_rating).collect();
    let domain_traffic: Vec<u64> = records.iter().map(|r| r.domain_traffic).collect();
    let referring_domains: Vec<u32> = records.iter().map(|r| r.referring_domains).collect();
    let linked_domains: Vec<u32> = records.iter().map(|r| r.linked_domains).collect();
    let external_links: Vec<u32> = records.iter().map(|r| r.external_links).collect();
    let page_traffic: Vec<u64> = records.iter().map(|r| r.page_traffic).collect();
    let keywords: Vec<u32> = records.iter().map(|r| r.keywords).collect();
    let target_url: Vec<&str> = records.iter().map(|r| r.target_url.as_str()).collect();
    let target_domain: Vec<&str> = records.iter().map(|r| r.target_domain.as_str()).collect();
    let target_path: Vec<&str> = records.iter().map(|r| r.target_path.as_str()).collect();
    let left_context: Vec<&str> = records.iter().map(|r| r.left_context.as_str()).collect();
    let anchor: Vec<&str> = records.iter().map(|r| r.anchor.as_str()).collect();
    let right_context: Vec<&str> = records.iter().map(|r| r.right_context.as_str()).collect();
    let redirect_chain_urls: Vec<&str> = records.iter().map(|r| r.redirect_chain_urls.as_str()).collect();
    let redirect_chain_codes: Vec<&str> = records.iter().map(|r| r.redirect_chain_codes.as_str()).collect();
    let link_type: Vec<&str> = records.iter().map(|r| r.link_type.as_str()).collect();
    let is_spam: Vec<bool> = records.iter().map(|r| r.is_spam).collect();
    let is_content: Vec<bool> = records.iter().map(|r| r.is_content).collect();
    let is_nofollow: Vec<bool> = records.iter().map(|r| r.is_nofollow).collect();
    let is_ugc: Vec<bool> = records.iter().map(|r| r.is_ugc).collect();
    let is_sponsored: Vec<bool> = records.iter().map(|r| r.is_sponsored).collect();
    let is_rendered: Vec<bool> = records.iter().map(|r| r.is_rendered).collect();
    let is_raw: Vec<bool> = records.iter().map(|r| r.is_raw).collect();
    let lost_status: Vec<&str> = records.iter().map(|r| r.lost_status.as_str()).collect();
    let drop_reason: Vec<&str> = records.iter().map(|r| r.drop_reason.as_str()).collect();
    let discovered_status: Vec<&str> = records.iter().map(|r| r.discovered_status.as_str()).collect();

    // Convert datetimes to millisecond timestamps for polars
    let first_seen: Vec<i64> = records.iter().map(|r| r.first_seen.and_utc().timestamp_millis()).collect();
    let last_seen: Vec<i64> = records.iter().map(|r| r.last_seen.and_utc().timestamp_millis()).collect();
    let lost_date: Vec<Option<i64>> = records
        .iter()
        .map(|r| r.lost_date.map(|d| d.and_utc().timestamp_millis()))
        .collect();

    let author: Vec<&str> = records.iter().map(|r| r.author.as_str()).collect();
    let page_type: Vec<&str> = records.iter().map(|r| r.page_type.as_str()).collect();
    let page_category: Vec<&str> = records.iter().map(|r| r.page_category.as_str()).collect();
    let links_in_group: Vec<u32> = records.iter().map(|r| r.links_in_group).collect();
    let source_file: Vec<&str> = records.iter().map(|r| r.source_file.as_str()).collect();
    let profile_label: Vec<&str> = records.iter().map(|r| r.profile_label.as_str()).collect();

    let _ = len; // used implicitly by Series lengths

    let mut df = DataFrame::new(vec![
        Column::new("referring_page_title".into(), &referring_page_title),
        Column::new("referring_url".into(), &referring_url),
        Column::new("referring_domain".into(), &referring_domain),
        Column::new("language".into(), &language),
        Column::new("platform".into(), &platform),
        Column::new("http_code".into(), &http_code),
        Column::new("domain_rating".into(), &domain_rating),
        Column::new("url_rating".into(), &url_rating),
        Column::new("domain_traffic".into(), &domain_traffic),
        Column::new("referring_domains".into(), &referring_domains),
        Column::new("linked_domains".into(), &linked_domains),
        Column::new("external_links".into(), &external_links),
        Column::new("page_traffic".into(), &page_traffic),
        Column::new("keywords".into(), &keywords),
        Column::new("target_url".into(), &target_url),
        Column::new("target_domain".into(), &target_domain),
        Column::new("target_path".into(), &target_path),
        Column::new("left_context".into(), &left_context),
        Column::new("anchor".into(), &anchor),
        Column::new("right_context".into(), &right_context),
        Column::new("redirect_chain_urls".into(), &redirect_chain_urls),
        Column::new("redirect_chain_codes".into(), &redirect_chain_codes),
        Column::new("link_type".into(), &link_type),
        Column::new("is_spam".into(), &is_spam),
        Column::new("is_content".into(), &is_content),
        Column::new("is_nofollow".into(), &is_nofollow),
        Column::new("is_ugc".into(), &is_ugc),
        Column::new("is_sponsored".into(), &is_sponsored),
        Column::new("is_rendered".into(), &is_rendered),
        Column::new("is_raw".into(), &is_raw),
        Column::new("lost_status".into(), &lost_status),
        Column::new("drop_reason".into(), &drop_reason),
        Column::new("discovered_status".into(), &discovered_status),
        Series::new("first_seen".into(), &first_seen).cast(&DataType::Datetime(TimeUnit::Milliseconds, None)).unwrap().into(),
        Series::new("last_seen".into(), &last_seen).cast(&DataType::Datetime(TimeUnit::Milliseconds, None)).unwrap().into(),
        Series::new("lost_date".into(), &lost_date).cast(&DataType::Datetime(TimeUnit::Milliseconds, None)).unwrap().into(),
        Column::new("author".into(), &author),
        Column::new("page_type".into(), &page_type),
        Column::new("page_category".into(), &page_category),
        Column::new("links_in_group".into(), &links_in_group),
        Column::new("source_file".into(), &source_file),
        Column::new("profile_label".into(), &profile_label),
    ])?;

    // Merge with existing parquet if present
    if output_path.exists() {
        let existing_file = std::fs::File::open(output_path)?;
        let existing_df = ParquetReader::new(existing_file).finish()?;
        let new_count = df.height();
        let mut combined = existing_df.vstack(&df)?;
        combined = combined.unique_stable(None, UniqueKeepStrategy::First, None)?;
        println!("    Merge: {} existing + {} new -> {} after dedup",
            existing_df.height(), new_count, combined.height());
        df = combined;
    }

    // Ensure output directory exists
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let file = std::fs::File::create(output_path)?;
    ParquetWriter::new(file).finish(&mut df)?;

    Ok(())
}
