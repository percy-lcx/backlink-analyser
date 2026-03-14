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

    // Single pass: collect all 47 columns simultaneously instead of 47 separate iterations
    let mut referring_page_title = Vec::with_capacity(len);
    let mut referring_url = Vec::with_capacity(len);
    let mut referring_domain = Vec::with_capacity(len);
    let mut language = Vec::with_capacity(len);
    let mut platform = Vec::with_capacity(len);
    let mut http_code = Vec::with_capacity(len);
    let mut domain_rating = Vec::with_capacity(len);
    let mut url_rating = Vec::with_capacity(len);
    let mut domain_traffic = Vec::with_capacity(len);
    let mut referring_domains = Vec::with_capacity(len);
    let mut linked_domains = Vec::with_capacity(len);
    let mut external_links = Vec::with_capacity(len);
    let mut page_traffic = Vec::with_capacity(len);
    let mut keywords = Vec::with_capacity(len);
    let mut target_url = Vec::with_capacity(len);
    let mut target_domain = Vec::with_capacity(len);
    let mut target_path = Vec::with_capacity(len);
    let mut left_context = Vec::with_capacity(len);
    let mut anchor = Vec::with_capacity(len);
    let mut right_context = Vec::with_capacity(len);
    let mut redirect_chain_urls = Vec::with_capacity(len);
    let mut redirect_chain_codes = Vec::with_capacity(len);
    let mut link_type = Vec::with_capacity(len);
    let mut is_spam = Vec::with_capacity(len);
    let mut is_content = Vec::with_capacity(len);
    let mut is_nofollow = Vec::with_capacity(len);
    let mut is_ugc = Vec::with_capacity(len);
    let mut is_sponsored = Vec::with_capacity(len);
    let mut is_rendered = Vec::with_capacity(len);
    let mut is_raw = Vec::with_capacity(len);
    let mut lost_status = Vec::with_capacity(len);
    let mut drop_reason = Vec::with_capacity(len);
    let mut discovered_status = Vec::with_capacity(len);
    let mut first_seen = Vec::with_capacity(len);
    let mut last_seen = Vec::with_capacity(len);
    let mut lost_date = Vec::with_capacity(len);
    let mut author = Vec::with_capacity(len);
    let mut page_type = Vec::with_capacity(len);
    let mut page_category = Vec::with_capacity(len);
    let mut links_in_group = Vec::with_capacity(len);
    let mut source_file = Vec::with_capacity(len);
    let mut profile_label = Vec::with_capacity(len);

    for r in records {
        referring_page_title.push(r.referring_page_title.as_str());
        referring_url.push(r.referring_url.as_str());
        referring_domain.push(r.referring_domain.as_str());
        language.push(r.language.as_str());
        platform.push(r.platform.as_str());
        http_code.push(r.http_code as u32);
        domain_rating.push(r.domain_rating);
        url_rating.push(r.url_rating);
        domain_traffic.push(r.domain_traffic);
        referring_domains.push(r.referring_domains);
        linked_domains.push(r.linked_domains);
        external_links.push(r.external_links);
        page_traffic.push(r.page_traffic);
        keywords.push(r.keywords);
        target_url.push(r.target_url.as_str());
        target_domain.push(r.target_domain.as_str());
        target_path.push(r.target_path.as_str());
        left_context.push(r.left_context.as_str());
        anchor.push(r.anchor.as_str());
        right_context.push(r.right_context.as_str());
        redirect_chain_urls.push(r.redirect_chain_urls.as_str());
        redirect_chain_codes.push(r.redirect_chain_codes.as_str());
        link_type.push(r.link_type.as_str());
        is_spam.push(r.is_spam);
        is_content.push(r.is_content);
        is_nofollow.push(r.is_nofollow);
        is_ugc.push(r.is_ugc);
        is_sponsored.push(r.is_sponsored);
        is_rendered.push(r.is_rendered);
        is_raw.push(r.is_raw);
        lost_status.push(r.lost_status.as_str());
        drop_reason.push(r.drop_reason.as_str());
        discovered_status.push(r.discovered_status.as_str());
        first_seen.push(r.first_seen.and_utc().timestamp_millis());
        last_seen.push(r.last_seen.and_utc().timestamp_millis());
        lost_date.push(r.lost_date.map(|d| d.and_utc().timestamp_millis()));
        author.push(r.author.as_str());
        page_type.push(r.page_type.as_str());
        page_category.push(r.page_category.as_str());
        links_in_group.push(r.links_in_group);
        source_file.push(r.source_file.as_str());
        profile_label.push(r.profile_label.as_str());
    }

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
        let mut combined = df.vstack(&existing_df)?;
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
