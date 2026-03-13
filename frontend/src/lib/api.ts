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
  is_nofollow: boolean;
  is_ugc: boolean;
  is_sponsored: boolean;
  is_spam: boolean;
  link_type: string;
  domain_rating: number;
  url_rating: number;
  page_traffic: number;
  first_seen: string;
  last_seen: string;
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
  dominant_anchor: string;
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
  profile: string;
  profile_label: string;
  total_backlinks: number;
  unique_domains: number;
  dofollow_ratio: number;
  avg_dr: number;
  spam_ratio: number;
  total_traffic: number;
}

export interface LinkGapDomain {
  referring_domain: string;
  domain_rating: number;
  profiles: string[];
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

/* ---- Endpoints (matching actual backend routes) ---- */

export interface LinkParams {
  page?: number;
  per_page?: number;
  sort?: string;
  is_nofollow?: boolean;
  is_spam?: boolean;
  link_type?: string;
  dr_min?: number;
  dr_max?: number;
  anchor_search?: string;
  anchor_exclude?: boolean;
  traffic_min?: number;
  traffic_max?: number;
  first_seen_from?: string;
  first_seen_to?: string;
  domain_search?: string;
  domain_exclude?: boolean;
  url_search?: string;
  url_exclude?: boolean;
  target_path_search?: string;
  target_path_exact?: boolean;
  target_path_exclude?: boolean;
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

export function fetchLinkAttributes(profile: string): Promise<LinkAttribute[]> {
  return get<LinkAttribute[]>(`${BASE}/link-attributes`, { profile });
}

export function fetchAnchors(profile: string, targetPath?: string): Promise<{ items: AnchorRecord[]; categories: Record<string, number> }> {
  return get<{ items: AnchorRecord[]; categories: Record<string, number> }>(`${BASE}/anchors`, { profile, target_path: targetPath });
}

export function fetchAnchorsContext(profile: string, anchor: string): Promise<AnchorContext[]> {
  return get<AnchorContext[]>(`${BASE}/anchors-context`, { profile, anchor });
}

export function fetchReferringDomains(profile: string, sort?: string): Promise<ReferringDomain[]> {
  return get<ReferringDomain[]>(`${BASE}/referring-domains`, { profile, sort });
}

export function fetchDrDistribution(profile: string): Promise<DrDistributionResponse> {
  return get<DrDistributionResponse>(`${BASE}/dr-distribution`, { profile });
}

export function fetchVelocity(profile: string, interval?: string): Promise<VelocityPoint[]> {
  return get<VelocityPoint[]>(`${BASE}/velocity`, { profile, interval });
}

export function fetchPageBreakdown(profile: string): Promise<PageBreakdownResponse> {
  return get<PageBreakdownResponse>(`${BASE}/page-breakdown`, { profile });
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

export function fetchCompare(profiles: string[]): Promise<CompareProfile[]> {
  return get<CompareProfile[]>(`${BASE}/compare`, { profiles: profiles.join(",") });
}

export function fetchLinkGap(base: string, competitors: string[]): Promise<LinkGapDomain[]> {
  return get<LinkGapDomain[]>(`${BASE}/link-gap`, { base, competitors: competitors.join(",") });
}

export function triggerIngest(): Promise<{ status: string }> {
  return post<{ status: string }>(`${BASE}/ingest`);
}
