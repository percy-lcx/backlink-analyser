const BASE = "/api";

async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

/* ---- Types ---- */

export type MatchMode = "contains" | "exact" | "regex";

export interface Profile {
  profile_label: string;
  total_links: number;
  unique_referring_domains: number;
  avg_dr: number;
}

export interface OverviewData {
  total_backlinks: number;
  unique_referring_domains: number;
  dofollow_count: number;
  nofollow_count: number;
  ugc_count: number;
  sponsored_count: number;
  image_link_count: number;
  text_link_count: number;
  avg_dr: number;
  median_dr: number;
  spam_ratio: number;
  total_page_traffic: number;
  newest_backlink_date: string | null;
}

export interface LinkRecord {
  referring_url: string;
  referring_domain: string;
  target_url: string;
  target_path: string;
  anchor: string;
  http_code: number;
  is_nofollow: boolean;
  is_ugc: boolean;
  is_sponsored: boolean;
  is_spam: boolean;
  link_type: string;
  domain_rating: number;
  url_rating: number;
  page_traffic: number;
  domain_traffic: number;
  first_seen: string;
  last_seen: string;
  lost_date: string | null;
  lost_status: string;
}

export interface LinksResponse {
  items: LinkRecord[];
  total: number;
  page: number;
  per_page: number;
}

export interface LinkAttribute {
  combination: string;
  count: number;
}

export interface AnchorRecord {
  anchor: string;
  count: number;
  category: string;
  pct: number;
}

export interface AnchorParams {
  anchor_search?: string;
  anchor_mode?: string;
  anchor_exclude?: boolean;
  category?: string;
  count_min?: number;
  count_max?: number;
}

export interface AnchorContext {
  left_context: string;
  anchor: string;
  right_context: string;
  referring_url: string;
}

export interface ReferringDomain {
  referring_domain: string;
  link_count: number;
  max_dr: number;
  total_traffic: number;
  is_sitewide: boolean;
}

export interface ReferringDomainParams {
  sort?: string;
  domain_search?: string;
  domain_mode?: string;
  domain_exclude?: boolean;
  dr_min?: number;
  dr_max?: number;
  traffic_min?: number;
  traffic_max?: number;
  links_min?: number;
  links_max?: number;
  is_sitewide?: boolean;
}

export interface DrBucket {
  bucket: string;
  count: number;
}

export interface DrDistributionResponse {
  dr: DrBucket[];
  ur: DrBucket[];
}

export interface VelocityPoint {
  period: string;
  new_count: number;
  lost_count: number;
  net: number;
}

export interface PageRow {
  target_path: string;
  category: string;
  link_count: number;
  unique_referring_domains: number;
  avg_dr: number;
  dofollow_ratio: number;
}

export interface PageBreakdownParams {
  target_path_search?: string;
  target_path_exclude?: boolean;
  target_path_mode?: string;
  category?: string;
  link_count_min?: number;
  link_count_max?: number;
  ref_domains_min?: number;
  ref_domains_max?: number;
  avg_dr_min?: number;
  avg_dr_max?: number;
  dofollow_min?: number;
  dofollow_max?: number;
}

export interface PageBreakdownResponse {
  pages: PageRow[];
  categories: Record<string, { link_count: number; unique_referring_domains: number; avg_dr: number; dofollow_ratio: number }>;
}

export interface QualityPoint {
  domain_rating: number;
  page_traffic: number;
  is_spam: boolean;
  referring_url: string;
}

export interface QualityResponse {
  items: QualityPoint[];
  total: number;
  page: number;
  page_size: number;
}

export interface SitewideDomain {
  referring_domain: string;
  link_count: number;
  dominant_anchor: string;
  max_dr: number;
}

export interface SitewideMetrics {
  with_sitewide: { total_links: number; unique_domains: number; avg_dr: number };
  without_sitewide: { total_links: number; unique_domains: number; avg_dr: number };
  flagged_domains: SitewideDomain[];
}

export interface CompareProfile {
  profile_label: string;
  total_links: number;
  referring_domains: number;
  avg_dr: number;
  median_dr: number;
  dofollow_ratio: number;
  spam_ratio: number;
  anchor_diversity: number;
  links_per_domain: number;
  sitewide_ratio: number;
  image_link_ratio: number;
}

export interface LinkGapDomain {
  referring_domain: string;
  max_dr: number;
  total_links: number;
  profiles_linking: string[];
}

export interface TargetPath {
  target_path: string;
  link_count: number;
}

export interface RedirectInfo {
  referring_url: string;
  target_url: string;
  chain_length: number;
  has_302: boolean;
  status_codes: number[];
  urls: string[];
}

export interface RedirectSummary {
  total_with_redirects: number;
  pct_with_redirects: number;
  pct_with_302: number;
  items: RedirectInfo[];
}

export interface IntersectDomain {
  referring_domain: string;
  max_dr: number;
  competitor_flags: boolean[];
  competitor_count: number;
}

export interface IntersectSummary {
  count: number;
  domains: number;
}

export interface IntersectResponse {
  competitors: string[];
  summary: IntersectSummary[];
  domains: IntersectDomain[];
}

export interface BrokenLinksSummary {
  total_broken: number;
  count_4xx: number;
  count_5xx: number;
  unique_domains_affected: number;
}

export interface HttpCodeBucket {
  http_code: number;
  count: number;
}

export interface BrokenLinksResponse {
  summary: BrokenLinksSummary;
  distribution: HttpCodeBucket[];
  items: LinkRecord[];
  total: number;
  page: number;
  per_page: number;
}

/* ---- Endpoints (matching actual backend routes) ---- */

export interface LinkParams {
  page?: number;
  per_page?: number;
  sort?: string;
  is_nofollow?: boolean;
  is_sponsored?: boolean;
  is_spam?: boolean;
  http_code?: string;
  link_type?: string;
  dr_min?: number;
  dr_max?: number;
  anchor_search?: string;
  anchor_exclude?: boolean;
  anchor_mode?: string;
  traffic_min?: number;
  traffic_max?: number;
  first_seen_from?: string;
  first_seen_to?: string;
  domain_search?: string;
  domain_exclude?: boolean;
  domain_mode?: string;
  url_search?: string;
  url_exclude?: boolean;
  url_mode?: string;
  target_path_search?: string;
  target_path_exact?: boolean;
  target_path_exclude?: boolean;
  target_path_mode?: string;
  lost_date_from?: string;
  lost_date_to?: string;
  lost_status_search?: string;
  lost_status_exclude?: boolean;
  lost_status_mode?: string;
}

export function fetchProfiles(): Promise<Profile[]> {
  return get<Profile[]>(`${BASE}/profiles`);
}

export function fetchOverview(profile: string): Promise<OverviewData> {
  return get<OverviewData>(`${BASE}/overview`, { profile });
}

export function fetchLinks(profile: string, params?: LinkParams): Promise<LinksResponse> {
  return get<LinksResponse>(`${BASE}/links`, { profile, ...params } as Record<string, string | number | boolean | undefined>);
}

export function fetchHttpCodes(profile: string): Promise<{ codes: number[] }> {
  return get<{ codes: number[] }>(`${BASE}/http-codes`, { profile });
}

export function fetchLinkAttributes(profile: string): Promise<LinkAttribute[]> {
  return get<LinkAttribute[]>(`${BASE}/link-attributes`, { profile });
}

export function fetchAnchors(profile: string, params?: AnchorParams & { target_path?: string }): Promise<{ items: AnchorRecord[]; categories: Record<string, number> }> {
  return get<{ items: AnchorRecord[]; categories: Record<string, number> }>(`${BASE}/anchors`, { profile, ...params } as Record<string, string | number | boolean | undefined>);
}

export function fetchAnchorsContext(profile: string, anchor: string): Promise<AnchorContext[]> {
  return get<AnchorContext[]>(`${BASE}/anchors-context`, { profile, anchor });
}

export function fetchReferringDomains(profile: string, params?: ReferringDomainParams): Promise<ReferringDomain[]> {
  return get<ReferringDomain[]>(`${BASE}/referring-domains`, { profile, ...params } as Record<string, string | number | boolean | undefined>);
}

export function fetchDrDistribution(profile: string, targetPath?: string): Promise<DrDistributionResponse> {
  return get<DrDistributionResponse>(`${BASE}/dr-distribution`, { profile, target_path: targetPath });
}

export function fetchVelocity(profile: string, interval?: string): Promise<VelocityPoint[]> {
  return get<VelocityPoint[]>(`${BASE}/velocity`, { profile, interval });
}

export function fetchPageBreakdown(profile: string, params?: PageBreakdownParams): Promise<PageBreakdownResponse> {
  return get<PageBreakdownResponse>(`${BASE}/page-breakdown`, { profile, ...params } as Record<string, string | number | boolean | undefined>);
}

export function fetchRedirects(profile: string): Promise<RedirectSummary> {
  return get<RedirectSummary>(`${BASE}/redirects`, { profile });
}

export function fetchQualityMatrix(profile: string, page?: number): Promise<QualityResponse> {
  return get<QualityResponse>(`${BASE}/quality-matrix`, { profile, page });
}

export function fetchSitewide(profile: string, threshold?: number): Promise<SitewideMetrics> {
  return get<SitewideMetrics>(`${BASE}/sitewide`, { profile, threshold });
}

export function fetchCompare(profiles: string[], targetPaths?: string[]): Promise<CompareProfile[]> {
  return get<CompareProfile[]>(`${BASE}/compare`, {
    profiles: profiles.join(","),
    target_paths: targetPaths ? targetPaths.join(",") : undefined,
  });
}

export function fetchLinkGap(
  base: string,
  competitors: string[],
  baseTargetPath?: string,
  competitorTargetPath?: string,
): Promise<LinkGapDomain[]> {
  return get<LinkGapDomain[]>(`${BASE}/link-gap`, {
    base,
    competitors: competitors.join(","),
    base_target_path: baseTargetPath,
    competitor_target_path: competitorTargetPath,
  });
}

export function fetchLinkIntersect(
  base: string,
  competitors: string[],
  minDr?: number,
): Promise<IntersectResponse> {
  return get<IntersectResponse>(`${BASE}/link-intersect`, {
    base,
    competitors: competitors.join(","),
    min_dr: minDr,
  });
}

export function fetchTargetPaths(profile: string): Promise<TargetPath[]> {
  return get<TargetPath[]>(`${BASE}/target-paths`, { profile });
}

export function fetchBrokenLinks(
  profile: string,
  params?: {
    page?: number;
    per_page?: number;
    sort?: string;
    domain_search?: string;
    domain_mode?: string;
    domain_exclude?: boolean;
    http_code?: string;
    dr_min?: number;
    dr_max?: number;
  },
): Promise<BrokenLinksResponse> {
  return get<BrokenLinksResponse>(`${BASE}/broken-links`, {
    profile,
    ...params,
  } as Record<string, string | number | boolean | undefined>);
}

export function triggerIngest(): Promise<{ status: string }> {
  return post<{ status: string }>(`${BASE}/ingest`);
}
