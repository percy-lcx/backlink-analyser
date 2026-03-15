import { useState, useEffect, useCallback, useRef } from "react";
import { useProfile } from "./components/ProfileContext";
import SummaryCard from "./components/SummaryCard";
import DrDistribution from "./components/charts/DrDistribution";
import VelocityChart from "./components/charts/VelocityChart";
import ScatterPlot from "./components/charts/ScatterPlot";
import PageCategoryChart from "./components/charts/PageCategoryChart";
import TopPagesChart from "./components/charts/TopPagesChart";
import CompareTab from "./components/CompareTab";
import IntersectTab from "./components/IntersectTab";
import TerminologyTab from "./components/TerminologyTab";
import DataTable, { type SortingState } from "./components/tables/DataTable";
import ExportButton from "./components/tables/ExportButton";
import FilterInput from "./components/FilterInput";
import {
  fetchOverview,
  fetchDrDistribution,
  fetchVelocity,
  fetchLinks,
  fetchHttpCodes,
  fetchReferringDomains,
  fetchAnchors,
  fetchQualityMatrix,
  fetchPageBreakdown,
  triggerIngest,
  type OverviewData,
  type DrBucket,
  type VelocityPoint,
  type LinkRecord,
  type ReferringDomain,
  type AnchorRecord,
  type QualityPoint,
  type LinksResponse,
  type PageRow,
  type PageBreakdownResponse,
  type MatchMode,
} from "./lib/api";
import type { ColumnDef } from "@tanstack/react-table";
import { METRICS } from "./lib/metrics";

const linkColumns: ColumnDef<LinkRecord, unknown>[] = [
  { accessorKey: "referring_domain", header: "Referring Domain", meta: { tooltip: METRICS.referring_domain.short } },
  {
    accessorKey: "referring_url",
    header: "Referring URL",
    size: 400,
    meta: { tooltip: METRICS.referring_url.short },
    cell: ({ getValue }) => {
      const url = getValue() as string;
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline break-all"
          title={url}
        >
          {url}
        </a>
      );
    },
  },
  { accessorKey: "anchor", header: "Anchor", size: 400, meta: { tooltip: METRICS.anchor.short } },
  { accessorKey: "target_path", header: "Target", size: 400, meta: { tooltip: METRICS.target.short } },
  { accessorKey: "domain_rating", header: "DR", meta: { tooltip: METRICS.dr.short } },
  { accessorKey: "url_rating", header: "UR" },
  { accessorKey: "page_traffic", header: "Page Traffic", meta: { tooltip: METRICS.page_traffic.short } },
  { accessorKey: "domain_traffic", header: "Domain Traffic", meta: { tooltip: METRICS.domain_traffic.short } },
  { accessorKey: "link_type", header: "Type", meta: { tooltip: METRICS.link_type.short } },
  {
    accessorKey: "http_code",
    header: "Status",
    meta: { tooltip: "HTTP status code of the referring page." },
    cell: ({ getValue }) => {
      const code = getValue() as number;
      if (code == null || code === 0) return <span className="text-gray-400">—</span>;
      const color = code >= 200 && code < 300 ? "text-green-600" : code >= 300 && code < 400 ? "text-yellow-600" : "text-red-600";
      return <span className={color}>{code}</span>;
    },
  },
  {
    accessorKey: "is_nofollow",
    header: "NF",
    meta: { tooltip: METRICS.nf.short },
    cell: ({ getValue }) => (getValue() ? "Yes" : ""),
  },
  {
    accessorKey: "is_sponsored",
    header: "Sponsored",
    meta: { tooltip: "Whether the link has a rel=\"sponsored\" attribute." },
    cell: ({ getValue }) => (getValue() ? "Yes" : ""),
  },
  {
    accessorKey: "is_spam",
    header: "Spam",
    meta: { tooltip: METRICS.spam.short },
    cell: ({ getValue }) => (getValue() ? "Yes" : ""),
  },
  { accessorKey: "first_seen", header: "First Seen", meta: { tooltip: METRICS.first_seen.short } },
  {
    accessorKey: "lost_date",
    header: "Lost",
    meta: { tooltip: "Date when the backlink was lost." },
    cell: ({ getValue }) => {
      const val = getValue() as string | null;
      if (!val) return <span className="text-gray-400">—</span>;
      return val;
    },
  },
  {
    accessorKey: "lost_status",
    header: "Lost Status",
    meta: { tooltip: "Reason the backlink was lost." },
    cell: ({ getValue }) => {
      const val = getValue() as string;
      if (!val) return <span className="text-gray-400">—</span>;
      return val;
    },
  },
];

const domainColumns: ColumnDef<ReferringDomain, unknown>[] = [
  { accessorKey: "referring_domain", header: "Domain", size: 400, meta: { tooltip: METRICS.domain.short } },
  { accessorKey: "link_count", header: "Links", meta: { tooltip: METRICS.links.short } },
  { accessorKey: "max_dr", header: "DR", meta: { tooltip: METRICS.dr.short } },
  { accessorKey: "total_traffic", header: "Traffic", meta: { tooltip: METRICS.traffic.short } },
  {
    accessorKey: "is_sitewide",
    header: "Sitewide",
    meta: { tooltip: METRICS.sitewide.short },
    cell: ({ getValue }) => (getValue() ? "Yes" : ""),
  },
];

const anchorColumns: ColumnDef<AnchorRecord, unknown>[] = [
  { accessorKey: "anchor", header: "Anchor Text", size: 400, meta: { tooltip: METRICS.anchor_text.short } },
  { accessorKey: "count", header: "Count", meta: { tooltip: METRICS.count.short } },
  { accessorKey: "category", header: "Category", meta: { tooltip: METRICS.category.short } },
  {
    accessorKey: "pct",
    header: "%",
    meta: { tooltip: METRICS.pct.short },
    cell: ({ getValue }) => `${(getValue() as number).toFixed(1)}%`,
  },
];

const pageColumns: ColumnDef<PageRow, unknown>[] = [
  { accessorKey: "target_path", header: "Target URL", size: 400, meta: { tooltip: METRICS.target_url.short } },
  { accessorKey: "category", header: "Category", meta: { tooltip: METRICS.category.short } },
  { accessorKey: "link_count", header: "Backlinks", meta: { tooltip: METRICS.backlinks.short } },
  { accessorKey: "unique_referring_domains", header: "Ref. Domains", meta: { tooltip: METRICS.ref_domains.short } },
  {
    accessorKey: "avg_dr",
    header: "Avg DR",
    meta: { tooltip: METRICS.avg_dr.short },
    cell: ({ getValue }) => (getValue() as number)?.toFixed(1) ?? "—",
  },
  {
    accessorKey: "dofollow_ratio",
    header: "Dofollow %",
    meta: { tooltip: METRICS.dofollow_pct.short },
    cell: ({ getValue }) => `${((getValue() as number) * 100).toFixed(0)}%`,
  },
];

type Tab = "overview" | "links" | "domains" | "anchors" | "pages" | "quality" | "compare" | "intersect" | "terminology";

function Dashboard() {
  const { profiles, selected, setSelected, loading, error, refresh } = useProfile();
  const [tab, setTab] = useState<Tab>("overview");

  // Ingest state
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);

  // Overview state
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [drDist, setDrDist] = useState<DrBucket[]>([]);
  const [velocity, setVelocity] = useState<VelocityPoint[]>([]);

  // Links state
  const [linksData, setLinksData] = useState<LinksResponse | null>(null);
  const [linkPage, setLinkPage] = useState(0);
  const [linkPageSize, setLinkPageSize] = useState(100);

  // Link filter state
  const [drilldownPath, setDrilldownPath] = useState<string | null>(null);
  const [targetPathInput, setTargetPathInput] = useState("");
  const [targetPathExclude, setTargetPathExclude] = useState(false);
  const [targetPathMode, setTargetPathMode] = useState<MatchMode>("contains");
  const [domainInput, setDomainInput] = useState("");
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [domainExclude, setDomainExclude] = useState(false);
  const [domainMode, setDomainMode] = useState<MatchMode>("contains");
  const [urlInput, setUrlInput] = useState("");
  const [urlFilter, setUrlFilter] = useState<string | null>(null);
  const [urlExclude, setUrlExclude] = useState(false);
  const [urlMode, setUrlMode] = useState<MatchMode>("contains");
  const [anchorInput, setAnchorInput] = useState("");
  const [anchorFilter, setAnchorFilter] = useState<string | null>(null);
  const [anchorExclude, setAnchorExclude] = useState(false);
  const [anchorMode, setAnchorMode] = useState<MatchMode>("contains");
  const [linkTypeFilter, setLinkTypeFilter] = useState<string>("");
  const [nofollowFilter, setNofollowFilter] = useState<string>("");
  const [sponsoredFilter, setSponsoredFilter] = useState<string>("");
  const [spamFilter, setSpamFilter] = useState<string>("");
  const [httpCodeFilter, setHttpCodeFilter] = useState<string[]>([]);
  const [httpCodes, setHttpCodes] = useState<number[]>([]);
  const [httpDropdownOpen, setHttpDropdownOpen] = useState(false);
  const httpDropdownRef = useRef<HTMLDivElement>(null);
  const httpCodeFilterKey = httpCodeFilter.join(",");
  const [drMin, setDrMin] = useState("");
  const [drMax, setDrMax] = useState("");
  const [trafficMin, setTrafficMin] = useState("");
  const [trafficMax, setTrafficMax] = useState("");
  const [firstSeenFrom, setFirstSeenFrom] = useState("");
  const [firstSeenTo, setFirstSeenTo] = useState("");
  const [sortParam, setSortParam] = useState("domain_rating:desc");

  // Domains state
  const [domains, setDomains] = useState<ReferringDomain[]>([]);
  const [domDomainInput, setDomDomainInput] = useState("");
  const [domDomainSearch, setDomDomainSearch] = useState<string | null>(null);
  const [domDrMin, setDomDrMin] = useState("");
  const [domDrMax, setDomDrMax] = useState("");
  const [domTrafficMin, setDomTrafficMin] = useState("");
  const [domTrafficMax, setDomTrafficMax] = useState("");
  const [domLinksMin, setDomLinksMin] = useState("");
  const [domLinksMax, setDomLinksMax] = useState("");
  const [domSitewideFilter, setDomSitewideFilter] = useState<string>("");
  const [domDomainMode, setDomDomainMode] = useState<MatchMode>("contains");

  // Anchors state
  const [anchors, setAnchors] = useState<AnchorRecord[]>([]);
  const [anchorTabSearch, setAnchorTabSearch] = useState("");
  const [anchorTabSearchFilter, setAnchorTabSearchFilter] = useState<string | null>(null);
  const [anchorCategoryFilter, setAnchorCategoryFilter] = useState("");
  const [anchorCountMin, setAnchorCountMin] = useState("");
  const [anchorCountMax, setAnchorCountMax] = useState("");
  const [anchorTabMode, setAnchorTabMode] = useState<MatchMode>("contains");

  // Pages state
  const [pages, setPages] = useState<PageRow[]>([]);
  const [pageCategories, setPageCategories] = useState<PageBreakdownResponse["categories"]>({});
  const [pagePathInput, setPagePathInput] = useState("");
  const [pagePathFilter, setPagePathFilter] = useState<string | null>(null);
  const [pagePathExclude, setPagePathExclude] = useState(false);
  const [pageCategoryFilter, setPageCategoryFilter] = useState("");
  const [pageLinksMin, setPageLinksMin] = useState("");
  const [pageLinksMax, setPageLinksMax] = useState("");
  const [pageDomainsMin, setPageDomainsMin] = useState("");
  const [pageDomainsMax, setPageDomainsMax] = useState("");
  const [pageDrMin, setPageDrMin] = useState("");
  const [pageDrMax, setPageDrMax] = useState("");
  const [pageDofollowMin, setPageDofollowMin] = useState("");
  const [pageDofollowMax, setPageDofollowMax] = useState("");

  // Quality state
  const [quality, setQuality] = useState<QualityPoint[]>([]);

  // Fetch available HTTP status codes when profile changes
  useEffect(() => {
    if (!selected) return;
    fetchHttpCodes(selected).then((r) => setHttpCodes(r.codes ?? [])).catch(() => setHttpCodes([]));
  }, [selected]);

  // Close HTTP dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (httpDropdownRef.current && !httpDropdownRef.current.contains(e.target as Node)) {
        setHttpDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!selected) return;
    if (tab === "overview") {
      fetchOverview(selected).then(setOverview).catch(() => setOverview(null));
      fetchDrDistribution(selected).then((d) => setDrDist(d.dr ?? [])).catch(() => setDrDist([]));
      fetchVelocity(selected).then(setVelocity).catch(() => setVelocity([]));
    } else if (tab === "links") {
      const params: Record<string, unknown> = { page: linkPage + 1, per_page: linkPageSize, sort: sortParam };
      if (drilldownPath) {
        params.target_path_search = drilldownPath;
        if (targetPathMode !== "contains") params.target_path_mode = targetPathMode;
        if (targetPathExclude) params.target_path_exclude = true;
      }
      if (domainFilter) {
        params.domain_search = domainFilter;
        if (domainMode !== "contains") params.domain_mode = domainMode;
        if (domainExclude) params.domain_exclude = true;
      }
      if (urlFilter) {
        params.url_search = urlFilter;
        if (urlMode !== "contains") params.url_mode = urlMode;
        if (urlExclude) params.url_exclude = true;
      }
      if (anchorFilter) {
        params.anchor_search = anchorFilter;
        if (anchorMode !== "contains") params.anchor_mode = anchorMode;
        if (anchorExclude) params.anchor_exclude = true;
      }
      if (linkTypeFilter) params.link_type = linkTypeFilter;
      if (nofollowFilter) params.is_nofollow = nofollowFilter === "yes";
      if (sponsoredFilter) params.is_sponsored = sponsoredFilter === "yes";
      if (spamFilter) params.is_spam = spamFilter === "yes";
      if (httpCodeFilter.length > 0) params.http_code = httpCodeFilter.join(",");
      if (drMin) params.dr_min = parseFloat(drMin);
      if (drMax) params.dr_max = parseFloat(drMax);
      if (trafficMin) params.traffic_min = parseFloat(trafficMin);
      if (trafficMax) params.traffic_max = parseFloat(trafficMax);
      if (firstSeenFrom) params.first_seen_from = firstSeenFrom;
      if (firstSeenTo) params.first_seen_to = firstSeenTo;
      fetchLinks(selected, params as Parameters<typeof fetchLinks>[1])
        .then(setLinksData)
        .catch(() => setLinksData(null));
    } else if (tab === "domains") {
      const domParams: Record<string, string | number | boolean | undefined> = {};
      if (domDomainSearch) {
        domParams.domain_search = domDomainSearch;
        if (domDomainMode !== "contains") domParams.domain_mode = domDomainMode;
      }
      if (domDrMin) domParams.dr_min = parseFloat(domDrMin);
      if (domDrMax) domParams.dr_max = parseFloat(domDrMax);
      if (domTrafficMin) domParams.traffic_min = parseFloat(domTrafficMin);
      if (domTrafficMax) domParams.traffic_max = parseFloat(domTrafficMax);
      if (domLinksMin) domParams.links_min = parseInt(domLinksMin);
      if (domLinksMax) domParams.links_max = parseInt(domLinksMax);
      if (domSitewideFilter) domParams.is_sitewide = domSitewideFilter === "yes";
      fetchReferringDomains(selected, domParams).then(setDomains).catch(() => setDomains([]));
    } else if (tab === "anchors") {
      const anchorParams: Record<string, string | number | boolean | undefined> = {};
      if (anchorTabSearchFilter) {
        anchorParams.anchor_search = anchorTabSearchFilter;
        if (anchorTabMode !== "contains") anchorParams.anchor_mode = anchorTabMode;
      }
      if (anchorCategoryFilter) anchorParams.category = anchorCategoryFilter;
      if (anchorCountMin) anchorParams.count_min = parseInt(anchorCountMin);
      if (anchorCountMax) anchorParams.count_max = parseInt(anchorCountMax);
      fetchAnchors(selected, anchorParams).then((data) => {
        const items = Array.isArray(data) ? data : (data as { items: AnchorRecord[] }).items ?? [];
        const total = items.reduce((s, a) => s + a.count, 0);
        setAnchors(items.map((a) => ({ ...a, pct: total > 0 ? (a.count / total) * 100 : 0 })));
      }).catch(() => setAnchors([]));
    } else if (tab === "pages") {
      const pageParams: Record<string, string | number | boolean | undefined> = {};
      if (pagePathFilter) {
        pageParams.target_path_search = pagePathFilter;
        if (pagePathExclude) pageParams.target_path_exclude = true;
      }
      if (pageCategoryFilter) pageParams.category = pageCategoryFilter;
      if (pageLinksMin) pageParams.link_count_min = parseInt(pageLinksMin);
      if (pageLinksMax) pageParams.link_count_max = parseInt(pageLinksMax);
      if (pageDomainsMin) pageParams.ref_domains_min = parseInt(pageDomainsMin);
      if (pageDomainsMax) pageParams.ref_domains_max = parseInt(pageDomainsMax);
      if (pageDrMin) pageParams.avg_dr_min = parseFloat(pageDrMin);
      if (pageDrMax) pageParams.avg_dr_max = parseFloat(pageDrMax);
      if (pageDofollowMin) pageParams.dofollow_min = parseFloat(pageDofollowMin) / 100;
      if (pageDofollowMax) pageParams.dofollow_max = parseFloat(pageDofollowMax) / 100;
      fetchPageBreakdown(selected, pageParams).then((data) => {
        const items = Array.isArray(data) ? data : (data as { pages: PageRow[] }).pages ?? [];
        setPages(items);
        setPageCategories((data as PageBreakdownResponse).categories ?? {});
      }).catch(() => { setPages([]); setPageCategories({}); });
    } else if (tab === "quality") {
      fetchQualityMatrix(selected).then((r) => setQuality(r.items)).catch(() => setQuality([]));
    }
  }, [selected, tab, linkPage, linkPageSize, sortParam, drilldownPath, targetPathMode, targetPathExclude, domainFilter, domainMode, domainExclude, urlFilter, urlMode, urlExclude, anchorFilter, anchorMode, anchorExclude, linkTypeFilter, nofollowFilter, sponsoredFilter, spamFilter, httpCodeFilterKey, drMin, drMax, trafficMin, trafficMax, firstSeenFrom, firstSeenTo, domDomainSearch, domDomainMode, domDrMin, domDrMax, domTrafficMin, domTrafficMax, domLinksMin, domLinksMax, domSitewideFilter, anchorTabSearchFilter, anchorTabMode, anchorCategoryFilter, anchorCountMin, anchorCountMax, pagePathFilter, pagePathExclude, pageCategoryFilter, pageLinksMin, pageLinksMax, pageDomainsMin, pageDomainsMax, pageDrMin, pageDrMax, pageDofollowMin, pageDofollowMax]);

  // Reset link page when any filter changes
  useEffect(() => {
    setLinkPage(0);
  }, [drilldownPath, domainFilter, urlFilter, anchorFilter, linkTypeFilter, nofollowFilter, sponsoredFilter, spamFilter, httpCodeFilterKey, drMin, drMax, trafficMin, trafficMax, firstSeenFrom, firstSeenTo, sortParam]);

  // Stable callbacks for FilterInput debounce handlers
  const setDrilldownPathCb = useCallback((v: string | null) => setDrilldownPath(v), []);
  const setDomainFilterCb = useCallback((v: string | null) => setDomainFilter(v), []);
  const setUrlFilterCb = useCallback((v: string | null) => setUrlFilter(v), []);
  const setAnchorFilterCb = useCallback((v: string | null) => setAnchorFilter(v), []);
  const setDomDomainSearchCb = useCallback((v: string | null) => setDomDomainSearch(v), []);
  const setAnchorTabSearchFilterCb = useCallback((v: string | null) => setAnchorTabSearchFilter(v), []);
  const setPagePathFilterCb = useCallback((v: string | null) => setPagePathFilter(v), []);

  // Convert TanStack sorting state to backend sort param
  const handleSortChange = (sorting: SortingState) => {
    if (sorting.length > 0) {
      setSortParam(`${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`);
    } else {
      setSortParam("domain_rating:desc");
    }
  };

  const handleIngest = async () => {
    setIngesting(true);
    setIngestMsg(null);
    try {
      const result = await triggerIngest();
      setIngestMsg(result.status === "ok" ? "Ingestion complete" : `Status: ${result.status}`);
      refresh();
    } catch (err) {
      setIngestMsg(`Failed: ${err}`);
    } finally {
      setIngesting(false);
    }
  };

  // Click a page row → drilldown into its backlinks (exact match)
  const handlePageRowClick = (row: PageRow) => {
    setTargetPathInput(row.target_path);
    setDrilldownPath(row.target_path);
    setTargetPathMode("exact");
    setTab("links");
  };

  // Click a domain row → drilldown into its backlinks
  const handleDomainRowClick = (row: ReferringDomain) => {
    setDomainInput(row.referring_domain);
    setDomainFilter(row.referring_domain);
    setTab("links");
  };

  // Click an anchor row → drilldown into its backlinks
  const handleAnchorRowClick = (row: AnchorRecord) => {
    setAnchorInput(row.anchor);
    setAnchorFilter(row.anchor);
    setTab("links");
  };

  // Click a link gap row in Compare → drilldown into that profile's links filtered by domain
  const handleGapRowClick = (profileLabel: string, referringDomain: string, targetPath?: string) => {
    handleTabClick("links");
    setSelected(profileLabel);
    setDomainInput(referringDomain);
    setDomainFilter(referringDomain);
    if (targetPath) {
      setTargetPathInput(targetPath);
      setDrilldownPath(targetPath);
      setTargetPathMode("exact");
    }
  };

  // Click a DR distribution bar in Compare → drilldown into links with DR range
  const handleDrBarClick = (profileLabel: string, drMin: number, drMax: number, targetPath?: string) => {
    handleTabClick("links");
    setSelected(profileLabel);
    setDrMin(String(drMin));
    setDrMax(String(drMax));
    if (targetPath) {
      setTargetPathInput(targetPath);
      setDrilldownPath(targetPath);
      setTargetPathMode("exact");
    }
  };

  // Clicking the Links tab directly clears any drilldown filter
  const handleTabClick = (t: Tab) => {
    if (t === "links") {
      setTargetPathInput("");
      setDrilldownPath(null);
      setTargetPathExclude(false);
      setDomainInput("");
      setDomainFilter(null);
      setDomainExclude(false);
      setUrlInput("");
      setUrlFilter(null);
      setUrlExclude(false);
      setAnchorInput("");
      setAnchorFilter(null);
      setAnchorExclude(false);
      setLinkTypeFilter("");
      setNofollowFilter("");
      setSponsoredFilter("");
      setSpamFilter("");
      setHttpCodeFilter([]);
      setDrMin("");
      setDrMax("");
      setTrafficMin("");
      setTrafficMax("");
      setFirstSeenFrom("");
      setFirstSeenTo("");
    }
    setTab(t);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;
  }

  if (profiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">No profiles found</p>
          {error && <p className="text-sm mt-2 text-red-500">Error: {error}</p>}
          <p className="text-sm mt-2">Ingest some backlink data first, then restart the backend.</p>
          <button
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
            onClick={handleIngest}
            disabled={ingesting}
          >
            {ingesting ? "Ingesting..." : "Run Ingestion"}
          </button>
          {ingestMsg && <p className="text-sm mt-2 text-gray-600">{ingestMsg}</p>}
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "links", label: "Links" },
    { key: "domains", label: "Domains" },
    { key: "anchors", label: "Anchors" },
    { key: "pages", label: "Pages" },
    { key: "quality", label: "Quality" },
    { key: "compare", label: "Compare" },
    { key: "intersect", label: "Intersect" },
    { key: "terminology", label: "Terminology" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Backlink Analyser</h1>
          <div className="flex items-center gap-3">
            <button
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={handleIngest}
              disabled={ingesting}
            >
              {ingesting ? "Ingesting..." : "Re-ingest"}
            </button>
            {ingestMsg && <span className="text-xs text-gray-500">{ingestMsg}</span>}
            <select
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {profiles.map((p) => (
                <option key={p.profile_label} value={p.profile_label}>
                  {p.profile_label} ({(p.total_links ?? 0).toLocaleString()} links)
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-6 max-w-7xl mx-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => handleTabClick(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {tab === "overview" && overview && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard label="Total Backlinks" value={(overview.total_backlinks ?? 0).toLocaleString()} tooltip={METRICS.total_backlinks.short} />
              <SummaryCard label="Referring Domains" value={(overview.unique_referring_domains ?? 0).toLocaleString()} tooltip={METRICS.referring_domains.short} />
              <SummaryCard label="Dofollow" value={(overview.dofollow_count ?? 0).toLocaleString()} color="text-green-600" tooltip={METRICS.dofollow.short} />
              <SummaryCard label="Avg DR" value={overview.avg_dr?.toFixed(1) ?? "—"} tooltip={METRICS.avg_dr.short} />
              <SummaryCard label="Nofollow" value={(overview.nofollow_count ?? 0).toLocaleString()} tooltip={METRICS.nofollow.short} />
              <SummaryCard label="Spam Ratio" value={`${((overview.spam_ratio ?? 0) * 100).toFixed(1)}%`} color={(overview.spam_ratio ?? 0) > 0.1 ? "text-red-600" : "text-green-600"} tooltip={METRICS.spam_ratio.short} />
              <SummaryCard label="Image Links" value={(overview.image_link_count ?? 0).toLocaleString()} tooltip={METRICS.image_links.short} />
              <SummaryCard label="Total Backlink Traffic" value={(overview.total_page_traffic ?? 0).toLocaleString()} tooltip={METRICS.total_backlink_traffic.short} />
              <SummaryCard label="Newest Backlink" value={overview.newest_backlink_date ? new Date(overview.newest_backlink_date).toLocaleDateString() : "—"} tooltip={METRICS.newest_backlink.short} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DrDistribution data={drDist} />
              <VelocityChart data={velocity} />
            </div>
          </div>
        )}

        {tab === "links" && (
          <div>
            {/* Link filters */}
            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <FilterInput
                value={domainInput}
                onChange={setDomainInput}
                placeholder="Filter by domain..."
                excludePlaceholder="Exclude domain..."
                exclude={domainExclude}
                onExcludeChange={setDomainExclude}
                matchMode={domainMode}
                onMatchModeChange={setDomainMode}
                onDebouncedChange={setDomainFilterCb}
              />
              <FilterInput
                value={urlInput}
                onChange={setUrlInput}
                placeholder="Filter by URL..."
                excludePlaceholder="Exclude URL..."
                exclude={urlExclude}
                onExcludeChange={setUrlExclude}
                matchMode={urlMode}
                onMatchModeChange={setUrlMode}
                onDebouncedChange={setUrlFilterCb}
              />
              <FilterInput
                value={targetPathInput}
                onChange={setTargetPathInput}
                placeholder="Filter by target..."
                excludePlaceholder="Exclude target..."
                exclude={targetPathExclude}
                onExcludeChange={setTargetPathExclude}
                matchMode={targetPathMode}
                onMatchModeChange={setTargetPathMode}
                onDebouncedChange={setDrilldownPathCb}
              />
              <FilterInput
                value={anchorInput}
                onChange={setAnchorInput}
                placeholder="Filter by anchor..."
                excludePlaceholder="Exclude anchor..."
                exclude={anchorExclude}
                onExcludeChange={setAnchorExclude}
                matchMode={anchorMode}
                onMatchModeChange={setAnchorMode}
                onDebouncedChange={setAnchorFilterCb}
              />
              {linksData && (
                <span className="text-sm text-gray-400">
                  {linksData.total.toLocaleString()} backlinks
                </span>
              )}
            </div>
            {/* Row 2: dropdowns + ranges */}
            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <select
                value={linkTypeFilter}
                onChange={(e) => setLinkTypeFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Types</option>
                <option value="dofollow">Dofollow</option>
                <option value="nofollow">Nofollow</option>
                <option value="ugc">UGC</option>
                <option value="sponsored">Sponsored</option>
                <option value="image">Image</option>
              </select>
              <select
                value={nofollowFilter}
                onChange={(e) => setNofollowFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Nofollow: All</option>
                <option value="yes">Nofollow: Yes</option>
                <option value="no">Nofollow: No</option>
              </select>
              <select
                value={sponsoredFilter}
                onChange={(e) => setSponsoredFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Sponsored: All</option>
                <option value="yes">Sponsored: Yes</option>
                <option value="no">Sponsored: No</option>
              </select>
              <select
                value={spamFilter}
                onChange={(e) => setSpamFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Spam: All</option>
                <option value="yes">Spam: Yes</option>
                <option value="no">Spam: No</option>
              </select>
              <div className="relative" ref={httpDropdownRef}>
                <button
                  type="button"
                  onClick={() => setHttpDropdownOpen((o) => !o)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-1"
                >
                  {httpCodeFilter.length === 0 ? "Status: All" : `Status: ${httpCodeFilter.join(", ")}`}
                  <svg className="w-3 h-3 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {httpDropdownOpen && (
                  <div className="absolute z-10 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto min-w-[140px]">
                    {httpCodes.map((code) => (
                      <label key={code} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={httpCodeFilter.includes(String(code))}
                          onChange={(e) => {
                            setHttpCodeFilter((prev) =>
                              e.target.checked
                                ? [...prev, String(code)]
                                : prev.filter((c) => c !== String(code))
                            );
                          }}
                          className="rounded border-gray-300"
                        />
                        {code}
                      </label>
                    ))}
                    {httpCodes.length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-400">No status codes</div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">DR</span>
                <input type="number" placeholder="Min" value={drMin} onChange={(e) => setDrMin(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-gray-400">–</span>
                <input type="number" placeholder="Max" value={drMax} onChange={(e) => setDrMax(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Traffic</span>
                <input type="number" placeholder="Min" value={trafficMin} onChange={(e) => setTrafficMin(e.target.value)} className="w-20 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-gray-400">–</span>
                <input type="number" placeholder="Max" value={trafficMax} onChange={(e) => setTrafficMax(e.target.value)} className="w-20 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">First Seen</span>
                <input type="date" value={firstSeenFrom} onChange={(e) => setFirstSeenFrom(e.target.value)} className="border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-gray-400">–</span>
                <input type="date" value={firstSeenTo} onChange={(e) => setFirstSeenTo(e.target.value)} className="border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex justify-end mb-3">
                <ExportButton data={(linksData?.items ?? []) as unknown as Record<string, unknown>[]} filename="backlinks.csv" />
              </div>
              <DataTable
                data={linksData?.items ?? []}
                columns={linkColumns}
                pageSize={linkPageSize}
                manualPagination
                manualSorting
                onSortChange={handleSortChange}
                pageCount={linksData ? Math.ceil(linksData.total / linkPageSize) : 1}
                pageIndex={linkPage}
                onPageChange={setLinkPage}
                onPageSizeChange={setLinkPageSize}
              />
            </div>
          </div>
        )}

        {tab === "domains" && (
          <div>
            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <FilterInput
                value={domDomainInput}
                onChange={setDomDomainInput}
                placeholder="Filter by domain..."
                matchMode={domDomainMode}
                onMatchModeChange={setDomDomainMode}
                onDebouncedChange={setDomDomainSearchCb}
              />
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">DR</span>
                <input type="number" placeholder="Min" value={domDrMin} onChange={(e) => setDomDrMin(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-gray-400">–</span>
                <input type="number" placeholder="Max" value={domDrMax} onChange={(e) => setDomDrMax(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Traffic</span>
                <input type="number" placeholder="Min" value={domTrafficMin} onChange={(e) => setDomTrafficMin(e.target.value)} className="w-20 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-gray-400">–</span>
                <input type="number" placeholder="Max" value={domTrafficMax} onChange={(e) => setDomTrafficMax(e.target.value)} className="w-20 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Links</span>
                <input type="number" placeholder="Min" value={domLinksMin} onChange={(e) => setDomLinksMin(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-gray-400">–</span>
                <input type="number" placeholder="Max" value={domLinksMax} onChange={(e) => setDomLinksMax(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <select
                value={domSitewideFilter}
                onChange={(e) => setDomSitewideFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Sitewide: All</option>
                <option value="yes">Sitewide: Yes</option>
                <option value="no">Sitewide: No</option>
              </select>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Referring Domains</h3>
                  <p className="text-xs text-gray-400 mt-1">Click any row to see all backlinks from that domain.</p>
                </div>
                <ExportButton data={domains as unknown as Record<string, unknown>[]} filename="referring-domains.csv" />
              </div>
              <DataTable data={domains} columns={domainColumns} onRowClick={handleDomainRowClick} />
            </div>
          </div>
        )}

        {tab === "anchors" && (
          <div>
            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <FilterInput
                value={anchorTabSearch}
                onChange={setAnchorTabSearch}
                placeholder="Filter by anchor text..."
                matchMode={anchorTabMode}
                onMatchModeChange={setAnchorTabMode}
                onDebouncedChange={setAnchorTabSearchFilterCb}
              />
              <select
                value={anchorCategoryFilter}
                onChange={(e) => setAnchorCategoryFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Category: All</option>
                <option value="branded">Branded</option>
                <option value="exact_match">Exact Match</option>
                <option value="partial_match">Partial Match</option>
                <option value="naked_url">Naked URL</option>
                <option value="generic">Generic</option>
                <option value="image">Image</option>
                <option value="other">Other</option>
              </select>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Count</span>
                <input type="number" placeholder="Min" value={anchorCountMin} onChange={(e) => setAnchorCountMin(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-gray-400">–</span>
                <input type="number" placeholder="Max" value={anchorCountMax} onChange={(e) => setAnchorCountMax(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Anchor Text Distribution</h3>
                  <p className="text-xs text-gray-400 mt-1">Click any row to see all backlinks with that anchor text.</p>
                </div>
                <ExportButton data={anchors as unknown as Record<string, unknown>[]} filename="anchors.csv" />
              </div>
              <DataTable data={anchors} columns={anchorColumns} onRowClick={handleAnchorRowClick} />
            </div>
          </div>
        )}

        {tab === "pages" && (
          <div>
            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <FilterInput
                value={pagePathInput}
                onChange={setPagePathInput}
                placeholder="Filter by target URL..."
                excludePlaceholder="Exclude target URL..."
                exclude={pagePathExclude}
                onExcludeChange={setPagePathExclude}
                onDebouncedChange={setPagePathFilterCb}
              />
              <select
                value={pageCategoryFilter}
                onChange={(e) => setPageCategoryFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Category: All</option>
                <option value="homepage">Homepage</option>
                <option value="content">Content</option>
                <option value="money_pages">Money Pages</option>
                <option value="branding">Branding</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Backlinks</span>
                <input type="number" placeholder="Min" value={pageLinksMin} onChange={(e) => setPageLinksMin(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-gray-400">&ndash;</span>
                <input type="number" placeholder="Max" value={pageLinksMax} onChange={(e) => setPageLinksMax(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Ref. Domains</span>
                <input type="number" placeholder="Min" value={pageDomainsMin} onChange={(e) => setPageDomainsMin(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-gray-400">&ndash;</span>
                <input type="number" placeholder="Max" value={pageDomainsMax} onChange={(e) => setPageDomainsMax(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Avg DR</span>
                <input type="number" placeholder="Min" value={pageDrMin} onChange={(e) => setPageDrMin(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-gray-400">&ndash;</span>
                <input type="number" placeholder="Max" value={pageDrMax} onChange={(e) => setPageDrMax(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Dofollow %</span>
                <input type="number" placeholder="Min" value={pageDofollowMin} onChange={(e) => setPageDofollowMin(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-gray-400">&ndash;</span>
                <input type="number" placeholder="Max" value={pageDofollowMax} onChange={(e) => setPageDofollowMax(e.target.value)} className="w-16 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="space-y-6">
              {/* Summary cards */}
              {pages.length > 0 && (() => {
                const { totalBacklinks, weightedDr, weightedDf } = pages.reduce(
                  (acc, p) => ({
                    totalBacklinks: acc.totalBacklinks + p.link_count,
                    weightedDr: acc.weightedDr + (p.avg_dr ?? 0) * p.link_count,
                    weightedDf: acc.weightedDf + (p.dofollow_ratio ?? 0) * p.link_count,
                  }),
                  { totalBacklinks: 0, weightedDr: 0, weightedDf: 0 },
                );
                return (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <SummaryCard label="Total Pages" value={pages.length.toLocaleString()} tooltip={METRICS.total_pages.short} />
                    <SummaryCard label="Total Backlinks" value={totalBacklinks.toLocaleString()} tooltip={METRICS.total_page_backlinks.short} />
                    <SummaryCard label="Avg Backlinks/Page" value={(totalBacklinks / pages.length).toFixed(1)} tooltip={METRICS.avg_backlinks_per_page.short} />
                    <SummaryCard label="Avg DR" value={totalBacklinks > 0 ? (weightedDr / totalBacklinks).toFixed(1) : "—"} tooltip={METRICS.avg_dr.short} />
                    <SummaryCard label="Avg Dofollow %" value={totalBacklinks > 0 ? `${((weightedDf / totalBacklinks) * 100).toFixed(1)}%` : "—"} tooltip={METRICS.dofollow_pct.short} />
                  </div>
                );
              })()}

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PageCategoryChart
                  data={Object.entries(pageCategories).map(([category, d]) => ({ category, link_count: d.link_count }))}
                  onBarClick={(category) => setPageCategoryFilter(category)}
                />
                <TopPagesChart
                  data={pages}
                  onBarClick={(targetPath) => handlePageRowClick({ target_path: targetPath } as PageRow)}
                />
              </div>

              {/* Data table */}
              <div className="bg-white rounded-lg shadow p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">Backlinks by Target Page</h3>
                    <p className="text-xs text-gray-400 mt-1">Click any row to see all backlinks pointing to that URL.</p>
                  </div>
                  <ExportButton data={pages as unknown as Record<string, unknown>[]} filename="pages.csv" />
                </div>
                <DataTable
                  data={pages}
                  columns={pageColumns}
                  onRowClick={handlePageRowClick}
                />
              </div>
            </div>
          </div>
        )}

        {tab === "quality" && (
          <div className="bg-white rounded-lg shadow p-5">
            <ScatterPlot data={quality} />
          </div>
        )}

        {tab === "compare" && <CompareTab onDrBarClick={handleDrBarClick} onGapRowClick={handleGapRowClick} />}

        {tab === "intersect" && <IntersectTab onGapRowClick={handleGapRowClick} />}

        {tab === "terminology" && <TerminologyTab />}
      </main>
    </div>
  );
}

export default Dashboard;
