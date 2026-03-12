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
  name: string;
  link_count: number;
  last_ingested?: string;
}

export interface OverviewData {
  total_backlinks: number;
  unique_domains: number;
  dofollow_count: number;
  avg_dr: number;
  spam_ratio: number;
  total_traffic: number;
}

export interface LinkRecord {
  id: number;
  referring_url: string;
  referring_domain: string;
  target_url: string;
  target_path: string;
  anchor_text: string;
  anchor_category: string;
  is_nofollow: boolean;
  is_ugc: boolean;
  is_sponsored: boolean;
  is_image: boolean;
  is_spam: boolean;
  link_type: string;
  domain_rating: number;
  page_traffic: number;
  first_seen: string;
  last_seen: string;
  redirect_chain?: string[];
  redirect_status_codes?: number[];
}

export interface LinksResponse {
  items: LinkRecord[];
  total: number;
  page: number;
  page_size: number;
}

export interface LinkAttribute {
  combination: string;
  count: number;
}

export interface AnchorRecord {
  anchor_text: string;
  count: number;
  category: string;
  pct: number;
}

export interface AnchorContext {
  left: string;
  anchor: string;
  right: string;
  referring_url: string;
}

export interface ReferringDomain {
  domain: string;
  link_count: number;
  max_dr: number;
  traffic: number;
  sitewide: boolean;
  dominant_anchor: string;
}

export interface DrBucket {
  bucket: string;
  count: number;
}

export interface VelocityPoint {
  date: string;
  new_links: number;
  lost_links: number;
  net: number;
}

export interface PageGroup {
  page_type: string;
  link_count: number;
  referring_domains: number;
  dr_distribution: DrBucket[];
  top_anchors: AnchorRecord[];
}

export interface RedirectLink extends LinkRecord {
  chain_length: number;
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
  domain: string;
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
  total_backlinks: number;
  unique_domains: number;
  dofollow_ratio: number;
  avg_dr: number;
  spam_ratio: number;
  total_traffic: number;
}

export interface LinkGapDomain {
  domain: string;
  domain_rating: number;
  presence: Record<string, boolean>;
}

export interface RedirectSummary {
  total_with_redirects: number;
  pct_with_redirects: number;
  pct_with_302: number;
  items: RedirectLink[];
}

/* ---- Endpoints ---- */

export interface LinkParams {
  page?: number;
  page_size?: number;
  sort?: string;
  order?: string;
  is_nofollow?: boolean;
  is_spam?: boolean;
  link_type?: string;
  dr_min?: number;
  dr_max?: number;
  search?: string;
}

export function fetchProfiles(): Promise<Profile[]> {
  return get<Profile[]>(`${BASE}/profiles`);
}

export function fetchOverview(profile: string): Promise<OverviewData> {
  return get<OverviewData>(`${BASE}/profiles/${encodeURIComponent(profile)}/overview`);
}

export function fetchLinks(profile: string, params?: LinkParams): Promise<LinksResponse> {
  return get<LinksResponse>(`${BASE}/profiles/${encodeURIComponent(profile)}/links`, params as Record<string, string | number | boolean | undefined>);
}

export function fetchLinkAttributes(profile: string): Promise<LinkAttribute[]> {
  return get<LinkAttribute[]>(`${BASE}/profiles/${encodeURIComponent(profile)}/link-attributes`);
}

export function fetchAnchors(profile: string, targetPath?: string): Promise<AnchorRecord[]> {
  return get<AnchorRecord[]>(`${BASE}/profiles/${encodeURIComponent(profile)}/anchors`, { target_path: targetPath });
}

export function fetchAnchorsContext(profile: string, anchor: string): Promise<AnchorContext[]> {
  return get<AnchorContext[]>(`${BASE}/profiles/${encodeURIComponent(profile)}/anchors/context`, { anchor });
}

export function fetchReferringDomains(profile: string, sort?: string): Promise<ReferringDomain[]> {
  return get<ReferringDomain[]>(`${BASE}/profiles/${encodeURIComponent(profile)}/referring-domains`, { sort });
}

export function fetchDrDistribution(profile: string): Promise<DrBucket[]> {
  return get<DrBucket[]>(`${BASE}/profiles/${encodeURIComponent(profile)}/dr-distribution`);
}

export function fetchVelocity(profile: string, interval?: string): Promise<VelocityPoint[]> {
  return get<VelocityPoint[]>(`${BASE}/profiles/${encodeURIComponent(profile)}/velocity`, { interval });
}

export function fetchPageBreakdown(profile: string): Promise<PageGroup[]> {
  return get<PageGroup[]>(`${BASE}/profiles/${encodeURIComponent(profile)}/page-breakdown`);
}

export function fetchRedirects(profile: string): Promise<RedirectSummary> {
  return get<RedirectSummary>(`${BASE}/profiles/${encodeURIComponent(profile)}/redirects`);
}

export function fetchQualityMatrix(profile: string, page?: number): Promise<QualityResponse> {
  return get<QualityResponse>(`${BASE}/profiles/${encodeURIComponent(profile)}/quality-matrix`, { page });
}

export function fetchSitewide(profile: string, threshold?: number): Promise<SitewideMetrics> {
  return get<SitewideMetrics>(`${BASE}/profiles/${encodeURIComponent(profile)}/sitewide`, { threshold });
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
