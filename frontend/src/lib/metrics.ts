import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    tooltip?: string;
  }
}

export interface MetricDef {
  label: string;
  short: string;
  full: string;
  category: string;
}

export const METRICS: Record<string, MetricDef> = {
  // ── Overview ──────────────────────────────────────────────
  total_backlinks: {
    label: "Total Backlinks",
    short: "Total inbound links pointing to this site.",
    full: "The total count of all backlinks discovered pointing to the target website. This includes dofollow, nofollow, UGC, sponsored, and image links from all referring domains. A higher count generally indicates stronger off-page authority, but quality matters more than quantity.",
    category: "Overview",
  },
  referring_domains: {
    label: "Referring Domains",
    short: "Unique domains linking to this site.",
    full: "The number of distinct root domains that contain at least one backlink to the target site. A diverse set of referring domains is a strong signal of natural link building. Search engines weight unique referring domains heavily when assessing authority.",
    category: "Overview",
  },
  dofollow: {
    label: "Dofollow",
    short: "Links that pass ranking authority.",
    full: "The count of backlinks without a rel=\"nofollow\" attribute. Dofollow links pass PageRank and link equity to the target page, directly contributing to search engine rankings. A healthy backlink profile should have a majority of dofollow links.",
    category: "Overview",
  },
  avg_dr: {
    label: "Avg DR",
    short: "Average Domain Rating of referring domains.",
    full: "The mean Domain Rating across all referring domains. Domain Rating is a metric from 0 to 100 that measures the overall strength of a website's backlink profile. A higher average DR indicates that the site is attracting links from more authoritative sources.",
    category: "Overview",
  },
  nofollow: {
    label: "Nofollow",
    short: "Links that do not pass ranking authority.",
    full: "The count of backlinks with a rel=\"nofollow\" attribute. These links tell search engines not to pass link equity. While they don't directly boost rankings, nofollow links from authoritative sites still drive referral traffic and contribute to a natural-looking link profile.",
    category: "Overview",
  },
  spam_ratio: {
    label: "Spam Ratio",
    short: "Percentage of links flagged as spam.",
    full: "The proportion of backlinks identified as potentially spammy or low-quality. A high spam ratio may indicate negative SEO attacks, PBN links, or low-quality link building. Ideally this should be kept below 5-10%. Consider disavowing links from spammy sources.",
    category: "Overview",
  },
  image_links: {
    label: "Image Links",
    short: "Links embedded in images.",
    full: "The count of backlinks where the linking element is an image rather than text. Image links use the image's alt attribute as anchor text. They commonly come from infographics, badges, or hotlinked images. They pass link equity the same as text links.",
    category: "Overview",
  },
  total_backlink_traffic: {
    label: "Total Backlink Traffic",
    short: "Estimated monthly traffic from all referring pages.",
    full: "The sum of estimated organic search traffic across all pages that link to the target site. Higher traffic on referring pages means more potential referral visitors and greater visibility of the backlink. This metric helps prioritize which backlinks are driving the most value.",
    category: "Overview",
  },
  newest_backlink: {
    label: "Newest Backlink",
    short: "Date the most recent backlink was discovered.",
    full: "The date when the most recently discovered backlink was first seen. A recent date indicates active, ongoing link acquisition. If the newest backlink is old, it may signal that link building efforts have stalled or that the site is losing momentum.",
    category: "Overview",
  },

  // ── Links ─────────────────────────────────────────────────
  referring_domain: {
    label: "Referring Domain",
    short: "The root domain of the linking page.",
    full: "The root domain (e.g., example.com) of the website that contains the backlink. Multiple links can come from the same referring domain. Analysing referring domains helps identify your strongest supporters and spot patterns in your link profile.",
    category: "Links",
  },
  referring_url: {
    label: "Referring URL",
    short: "The exact page URL containing the backlink.",
    full: "The full URL of the specific page where the backlink is located. This allows you to verify the link exists, check its context, and assess whether the surrounding content is relevant to your site.",
    category: "Links",
  },
  anchor: {
    label: "Anchor",
    short: "The clickable text of the link.",
    full: "The visible, clickable text used in the hyperlink. Anchor text gives search engines context about the linked page's content. A natural anchor text profile includes a mix of branded, generic, exact-match, and partial-match anchors. Over-optimized anchor text can trigger algorithmic penalties.",
    category: "Links",
  },
  target: {
    label: "Target",
    short: "The page on your site that the link points to.",
    full: "The destination URL path on the target website that the backlink points to. Analysing targets helps identify which pages attract the most links, spot pages that need more link support, and detect deep links vs. homepage-only link profiles.",
    category: "Links",
  },
  dr: {
    label: "DR",
    short: "Domain Rating (0-100) of the referring domain.",
    full: "Domain Rating is a proprietary metric from 0 to 100 that estimates the overall strength of a domain's backlink profile. Higher DR domains are generally more authoritative. Links from high-DR domains carry more weight for SEO. DR is logarithmic, so the difference between DR 70 and DR 80 is much larger than between DR 10 and DR 20.",
    category: "Links",
  },
  page_traffic: {
    label: "Page Traffic",
    short: "Estimated monthly organic traffic to the linking page.",
    full: "The estimated number of monthly organic search visitors to the specific page containing the backlink. Pages with higher traffic provide more referral value and indicate that the page itself ranks well in search engines, making the backlink more valuable.",
    category: "Links",
  },
  domain_traffic: {
    label: "Domain Traffic",
    short: "Estimated monthly organic traffic to the entire referring domain.",
    full: "The estimated total monthly organic search traffic for the entire referring domain. This gives a broader picture of the domain's overall visibility and authority beyond just the linking page. High domain traffic generally correlates with higher quality backlinks.",
    category: "Links",
  },
  link_type: {
    label: "Type",
    short: "The link type: dofollow, nofollow, UGC, sponsored, or image.",
    full: "The classification of the backlink based on its HTML attributes. Dofollow links pass full link equity. Nofollow links (rel=\"nofollow\") suggest the site does not vouch for the link. UGC (User Generated Content) marks links in comments or forums. Sponsored marks paid or advertisement links. Image links use an image as the linking element.",
    category: "Links",
  },
  nf: {
    label: "NF",
    short: "Whether the link has a nofollow attribute.",
    full: "Indicates if the backlink carries a rel=\"nofollow\" attribute. \"Yes\" means the link is nofollowed and does not pass link equity by default. Blank means the link is dofollow. This is a quick way to filter and assess the follow status of links.",
    category: "Links",
  },
  spam: {
    label: "Spam",
    short: "Whether the link is flagged as potentially spammy.",
    full: "Indicates if the backlink has been flagged as potentially spammy based on various quality signals. Spam flags may be triggered by low-quality content, link farms, PBN patterns, or other manipulative characteristics. Spammy links should be reviewed and potentially disavowed.",
    category: "Links",
  },
  first_seen: {
    label: "First Seen",
    short: "Date the backlink was first discovered.",
    full: "The date when the backlink was first detected by the crawler. This helps track link acquisition over time, identify link building campaigns, and understand the velocity at which new backlinks are being gained.",
    category: "Links",
  },
  // ── Domains ───────────────────────────────────────────────
  domain: {
    label: "Domain",
    short: "The referring domain name.",
    full: "The root domain of a website that links to the target site. This view aggregates all individual backlinks from the same domain into a single entry, showing the overall relationship between the referring domain and the target site.",
    category: "Domains",
  },
  links: {
    label: "Links",
    short: "Number of backlinks from this domain.",
    full: "The total number of individual backlinks originating from this referring domain. Multiple links from the same domain have diminishing returns for SEO value. A very high count from a single domain may indicate sitewide links (e.g., footer or sidebar links).",
    category: "Domains",
  },
  traffic: {
    label: "Traffic",
    short: "Estimated monthly organic traffic to the referring domain.",
    full: "The estimated total monthly organic search traffic for the referring domain. Domains with higher traffic are typically more authoritative and provide more valuable backlinks. This metric helps prioritize outreach and relationship-building efforts.",
    category: "Domains",
  },
  top_anchor: {
    label: "Top Anchor",
    short: "The most frequently used anchor text from this domain.",
    full: "The anchor text that appears most often across all backlinks from this referring domain. This reveals how the referring site typically describes or references the target site. Consistently branded or relevant anchor text is a positive signal.",
    category: "Domains",
  },
  sitewide: {
    label: "Sitewide",
    short: "Whether the link appears across the entire referring site.",
    full: "Indicates if the backlink appears on most or all pages of the referring domain (e.g., in the header, footer, or sidebar). Sitewide links generate a high volume of backlinks from a single domain but carry reduced per-link value. They are common with partner badges, widgets, or sponsorship links.",
    category: "Domains",
  },

  // ── Anchors ───────────────────────────────────────────────
  anchor_text: {
    label: "Anchor Text",
    short: "The clickable text used in backlinks.",
    full: "The visible text of a hyperlink that users click. In this view, anchor texts are aggregated to show distribution patterns. A natural profile includes branded terms, URL-based anchors, generic phrases ('click here'), and topically relevant keywords. Over-concentration on exact-match keywords can appear manipulative.",
    category: "Anchors",
  },
  count: {
    label: "Count",
    short: "Number of backlinks using this anchor text.",
    full: "The total number of backlinks that use this specific anchor text. High counts for a single anchor text (especially exact-match keywords) may indicate unnatural link building. Branded anchors typically have the highest counts in a natural profile.",
    category: "Anchors",
  },
  category: {
    label: "Category",
    short: "The classification of the anchor text.",
    full: "The type category assigned to the anchor text, such as branded, exact-match, partial-match, generic, URL, or other. This classification helps assess whether the anchor text distribution looks natural to search engines. A diverse mix of categories is ideal.",
    category: "Anchors",
  },
  pct: {
    label: "%",
    short: "Percentage of total backlinks using this anchor.",
    full: "The proportion of all backlinks that use this particular anchor text, expressed as a percentage. This metric is critical for identifying over-optimized anchor text profiles. No single non-branded anchor should dominate the profile — ideally each represents less than 5-10% of total anchors.",
    category: "Anchors",
  },

  // ── Pages ─────────────────────────────────────────────────
  target_url: {
    label: "Target URL",
    short: "The specific page on your site receiving backlinks.",
    full: "The URL path of the page on the target website that is receiving backlinks. This view shows which pages on your site attract the most links, helping identify content assets that naturally earn links and pages that may need more link building support.",
    category: "Pages",
  },
  backlinks: {
    label: "Backlinks",
    short: "Total number of backlinks to this page.",
    full: "The total count of backlinks pointing to this specific target page. Pages with more backlinks tend to rank better, but the quality and relevance of those links matters as much as quantity. Compare this with unique referring domains for a fuller picture.",
    category: "Pages",
  },
  ref_domains: {
    label: "Ref. Domains",
    short: "Unique referring domains linking to this page.",
    full: "The number of unique root domains that link to this specific target page. This is often a stronger ranking signal than raw backlink count, as it represents the breadth of endorsement from different websites. Pages with many referring domains typically rank more competitively.",
    category: "Pages",
  },
  dofollow_pct: {
    label: "Dofollow %",
    short: "Percentage of links to this page that are dofollow.",
    full: "The proportion of backlinks to this page that are dofollow (pass link equity). A high dofollow percentage means more of the links are contributing to the page's search rankings. Most healthy pages have 70-90% dofollow links. Very low percentages may indicate the page is primarily linked from UGC or social sources.",
    category: "Pages",
  },

  total_pages: {
    label: "Total Pages",
    short: "Number of distinct target pages receiving backlinks.",
    full: "The total number of unique target pages that have at least one backlink pointing to them. A higher number indicates a more distributed link profile across the site.",
    category: "Pages",
  },
  total_page_backlinks: {
    label: "Total Backlinks",
    short: "Sum of all backlinks across all target pages.",
    full: "The aggregate count of backlinks across all target pages currently shown. When filters are active, this reflects only the filtered subset.",
    category: "Pages",
  },
  avg_backlinks_per_page: {
    label: "Avg Backlinks/Page",
    short: "Average number of backlinks per target page.",
    full: "The mean number of backlinks per target page. A high average with few pages suggests link concentration; a low average with many pages suggests broad but shallow link distribution.",
    category: "Pages",
  },
  page_category_chart: {
    label: "Category Breakdown",
    short: "Distribution of backlinks across page categories.",
    full: "Bar chart showing how backlinks are distributed across page categories (homepage, content, money pages, other). Click a bar to filter the table to that category. A healthy profile typically has links spread across multiple categories.",
    category: "Pages",
  },
  top_pages_chart: {
    label: "Top Pages",
    short: "Pages with the most backlinks.",
    full: "Horizontal bar chart showing the top 15 pages ranked by backlink count. Click a bar to drill down into the Links tab for that specific page. Helps identify content assets that attract the most links.",
    category: "Pages",
  },
  // ── Quality ───────────────────────────────────────────────
  quality_matrix: {
    label: "Quality Matrix",
    short: "Scatter plot of backlink DR vs. page traffic.",
    full: "A visual scatter plot showing each backlink positioned by its referring domain's DR (x-axis) and the linking page's organic traffic (y-axis). Ideal backlinks appear in the upper-right quadrant (high DR, high traffic). This chart helps quickly identify high-value links and spot clusters of low-quality links.",
    category: "Quality",
  },
  clean: {
    label: "Clean",
    short: "Links not flagged as spam.",
    full: "Backlinks that have passed quality checks and are not flagged as potentially spammy. Clean links represent the legitimate, valuable portion of the backlink profile. In the quality matrix, clean links are displayed in indigo to distinguish them from flagged spam links.",
    category: "Quality",
  },

  // ── Compare ───────────────────────────────────────────────
  total_links: {
    label: "Total Links",
    short: "Total backlinks for the compared profile.",
    full: "The total number of backlinks for each compared profile. This metric allows direct comparison of the overall link volume between two competing sites. A large delta may indicate one site has been more successful at link building or has been established longer.",
    category: "Compare",
  },
  spam_pct: {
    label: "Spam %",
    short: "Percentage of links flagged as spam.",
    full: "The proportion of backlinks flagged as spam for each compared profile. Lower is better — a high spam percentage suggests the site may have engaged in or been targeted by low-quality link building. Comparing spam ratios helps assess the relative cleanliness of each profile.",
    category: "Compare",
  },
  anchor_diversity: {
    label: "Anchor Diversity",
    short: "Number of unique anchor texts used across backlinks.",
    full: "The count of distinct anchor text strings across all backlinks. Higher diversity indicates a more natural link profile, as it suggests links are being created organically by different webmasters. Low diversity (many links with the same anchor) may signal manipulative link building.",
    category: "Compare",
  },

  // ── Overview Health ──────────────────────────────────────
  broken_links_alert: {
    label: "Broken Links",
    short: "Backlinks returning HTTP 4xx/5xx errors.",
    full: "The number of backlinks that return HTTP error status codes (4xx client errors or 5xx server errors). Broken links waste link equity and provide a poor user experience. Fixing broken incoming links by setting up redirects or reaching out to webmasters can recover lost SEO value.",
    category: "Overview",
  },
  sitewide_alert: {
    label: "Sitewide Links",
    short: "Links appearing across an entire referring site.",
    full: "Links that appear on most or all pages of a referring domain (e.g., footer, sidebar, header). While they generate high volume, each individual sitewide link carries reduced value. A high sitewide ratio can indicate unnatural link patterns.",
    category: "Overview",
  },
  redirect_alert: {
    label: "Redirect Issues",
    short: "Backlinks passing through redirects.",
    full: "The number of backlinks that pass through one or more redirects before reaching the target page. Redirect chains dilute link equity and slow page load times. Fixing redirect issues can improve both SEO value and user experience.",
    category: "Overview",
  },
  anchor_categories: {
    label: "Anchor Categories",
    short: "Distribution of anchor text types across all backlinks.",
    full: "A donut chart showing the proportion of anchor text categories: branded, exact-match, partial-match, generic, image, naked URL, and other. A natural profile has diverse categories with branded anchors dominating. Excessive exact-match anchors (>40%) may trigger algorithmic penalties.",
    category: "Overview",
  },

  // ── Charts ────────────────────────────────────────────────
  dr_distribution: {
    label: "DR Distribution",
    short: "Distribution of backlinks by Domain Rating buckets.",
    full: "A bar chart showing how backlinks are distributed across Domain Rating ranges (e.g., 0-10, 11-20, ..., 91-100). This reveals the quality profile of the link portfolio. A healthy distribution typically has a mix across ranges with meaningful representation in higher DR buckets.",
    category: "Charts",
  },
  link_velocity: {
    label: "Link Velocity",
    short: "Rate of new backlinks over time.",
    full: "A line chart tracking the number of new backlinks gained over successive time periods. Sudden spikes may indicate viral content or link building campaigns.",
    category: "Charts",
  },
  profile_comparison: {
    label: "Profile Comparison",
    short: "Radar chart comparing key metrics between profiles.",
    full: "A normalized radar chart that visually compares two link profiles across multiple dimensions: backlinks, referring domains, dofollow ratio, average DR, and anchor diversity. Values are normalized to a 0-100 scale for fair comparison. This provides a quick visual snapshot of relative strengths and weaknesses.",
    category: "Compare",
  },

  // ── Intersect ──────────────────────────────────────────────
  intersect_breakdown: {
    label: "Intersection Breakdown",
    short: "How many competitors each gap domain links to.",
    full: "A bar chart showing the distribution of gap domains by the number of competitors they link to. Domains linking to ALL competitors represent the strongest outreach opportunities — these sites are clearly open to linking in your niche but haven't linked to you yet.",
    category: "Intersect",
  },
  intersect_gap_domains: {
    label: "Gap Domains",
    short: "Domains linking to competitors but not to you.",
    full: "The full list of referring domains that link to one or more competitors but not to your site. Each row shows which specific competitors the domain links to, the domain's DR, and the total competitor count. Filter by intersection count to focus on the strongest opportunities (domains linking to all competitors).",
    category: "Intersect",
  },
  competitor_count: {
    label: "Competitor Count",
    short: "Number of selected competitors this domain links to.",
    full: "The number of competitors (out of those selected) that this referring domain links to. Higher counts indicate stronger link opportunities — a domain linking to all your competitors is very likely relevant to your niche and open to linking.",
    category: "Intersect",
  },
};

const labelIndex = new Map<string, MetricDef>();
for (const def of Object.values(METRICS)) {
  labelIndex.set(def.label, def);
}

export function getMetricByLabel(label: string): MetricDef | undefined {
  return labelIndex.get(label);
}
