import { useState, useEffect, useRef } from "react";
import { useProfile } from "./components/ProfileContext";
import SummaryCard from "./components/SummaryCard";
import DrDistribution from "./components/charts/DrDistribution";
import VelocityChart from "./components/charts/VelocityChart";
import ScatterPlot from "./components/charts/ScatterPlot";
import CompareTab from "./components/CompareTab";
import DataTable, { type SortingState } from "./components/tables/DataTable";
import ExportButton from "./components/tables/ExportButton";
import {
  fetchOverview,
  fetchDrDistribution,
  fetchVelocity,
  fetchLinks,
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
} from "./lib/api";
import type { ColumnDef } from "@tanstack/react-table";

const linkColumns: ColumnDef<LinkRecord, unknown>[] = [
  { accessorKey: "referring_domain", header: "Referring Domain" },
  {
    accessorKey: "referring_url",
    header: "Referring URL",
    size: 400,
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
  { accessorKey: "anchor", header: "Anchor", size: 400 },
  { accessorKey: "target_path", header: "Target", size: 400 },
  { accessorKey: "domain_rating", header: "DR" },
  { accessorKey: "page_traffic", header: "Page Traffic" },
  { accessorKey: "domain_traffic", header: "Domain Traffic" },
  { accessorKey: "link_type", header: "Type" },
  {
    accessorKey: "is_nofollow",
    header: "NF",
    cell: ({ getValue }) => (getValue() ? "Yes" : ""),
  },
  {
    accessorKey: "is_spam",
    header: "Spam",
    cell: ({ getValue }) => (getValue() ? "Yes" : ""),
  },
  { accessorKey: "first_seen", header: "First Seen" },
];

const domainColumns: ColumnDef<ReferringDomain, unknown>[] = [
  { accessorKey: "referring_domain", header: "Domain", size: 400 },
  { accessorKey: "link_count", header: "Links" },
  { accessorKey: "max_dr", header: "DR" },
  { accessorKey: "total_traffic", header: "Traffic" },
  { accessorKey: "dominant_anchor", header: "Top Anchor", size: 400 },
  {
    accessorKey: "is_sitewide",
    header: "Sitewide",
    cell: ({ getValue }) => (getValue() ? "Yes" : ""),
  },
];

const anchorColumns: ColumnDef<AnchorRecord, unknown>[] = [
  { accessorKey: "anchor", header: "Anchor Text", size: 400 },
  { accessorKey: "count", header: "Count" },
  { accessorKey: "category", header: "Category" },
  {
    accessorKey: "pct",
    header: "%",
    cell: ({ getValue }) => `${(getValue() as number).toFixed(1)}%`,
  },
];

const pageColumns: ColumnDef<PageRow, unknown>[] = [
  { accessorKey: "target_path", header: "Target URL", size: 400 },
  { accessorKey: "category", header: "Category" },
  { accessorKey: "link_count", header: "Backlinks" },
  { accessorKey: "unique_referring_domains", header: "Ref. Domains" },
  {
    accessorKey: "avg_dr",
    header: "Avg DR",
    cell: ({ getValue }) => (getValue() as number)?.toFixed(1) ?? "—",
  },
  {
    accessorKey: "dofollow_ratio",
    header: "Dofollow %",
    cell: ({ getValue }) => `${((getValue() as number) * 100).toFixed(0)}%`,
  },
];

type Tab = "overview" | "links" | "domains" | "anchors" | "pages" | "quality" | "compare";

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
  const [exactMatch, setExactMatch] = useState(false);
  const [targetPathExclude, setTargetPathExclude] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [domainExclude, setDomainExclude] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlFilter, setUrlFilter] = useState<string | null>(null);
  const [urlExclude, setUrlExclude] = useState(false);
  const [anchorInput, setAnchorInput] = useState("");
  const [anchorFilter, setAnchorFilter] = useState<string | null>(null);
  const [anchorExclude, setAnchorExclude] = useState(false);
  const [linkTypeFilter, setLinkTypeFilter] = useState<string>("");
  const [nofollowFilter, setNofollowFilter] = useState<string>("");
  const [spamFilter, setSpamFilter] = useState<string>("");
  const [drMin, setDrMin] = useState("");
  const [drMax, setDrMax] = useState("");
  const [trafficMin, setTrafficMin] = useState("");
  const [trafficMax, setTrafficMax] = useState("");
  const [firstSeenFrom, setFirstSeenFrom] = useState("");
  const [firstSeenTo, setFirstSeenTo] = useState("");
  const [sortParam, setSortParam] = useState("domain_rating:desc");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const domainDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const urlDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const anchorDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Domains state
  const [domains, setDomains] = useState<ReferringDomain[]>([]);

  // Anchors state
  const [anchors, setAnchors] = useState<AnchorRecord[]>([]);

  // Pages state
  const [pages, setPages] = useState<PageRow[]>([]);

  // Quality state
  const [quality, setQuality] = useState<QualityPoint[]>([]);

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
        if (exactMatch) params.target_path_exact = true;
        if (targetPathExclude) params.target_path_exclude = true;
      }
      if (domainFilter) {
        params.domain_search = domainFilter;
        if (domainExclude) params.domain_exclude = true;
      }
      if (urlFilter) {
        params.url_search = urlFilter;
        if (urlExclude) params.url_exclude = true;
      }
      if (anchorFilter) {
        params.anchor_search = anchorFilter;
        if (anchorExclude) params.anchor_exclude = true;
      }
      if (linkTypeFilter) params.link_type = linkTypeFilter;
      if (nofollowFilter) params.is_nofollow = nofollowFilter === "yes";
      if (spamFilter) params.is_spam = spamFilter === "yes";
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
      fetchReferringDomains(selected).then(setDomains).catch(() => setDomains([]));
    } else if (tab === "anchors") {
      fetchAnchors(selected).then((data) => {
        const items = Array.isArray(data) ? data : (data as { items: AnchorRecord[] }).items ?? [];
        const total = items.reduce((s, a) => s + a.count, 0);
        setAnchors(items.map((a) => ({ ...a, pct: total > 0 ? (a.count / total) * 100 : 0 })));
      }).catch(() => setAnchors([]));
    } else if (tab === "pages") {
      fetchPageBreakdown(selected).then((data) => {
        const items = Array.isArray(data) ? data : (data as { pages: PageRow[] }).pages ?? [];
        setPages(items);
      }).catch(() => setPages([]));
    } else if (tab === "quality") {
      fetchQualityMatrix(selected).then((r) => setQuality(r.items)).catch(() => setQuality([]));
    }
  }, [selected, tab, linkPage, linkPageSize, sortParam, drilldownPath, exactMatch, targetPathExclude, domainFilter, domainExclude, urlFilter, urlExclude, anchorFilter, anchorExclude, linkTypeFilter, nofollowFilter, spamFilter, drMin, drMax, trafficMin, trafficMax, firstSeenFrom, firstSeenTo]);

  // Reset link page when any filter changes
  useEffect(() => {
    setLinkPage(0);
  }, [drilldownPath, domainFilter, urlFilter, anchorFilter, linkTypeFilter, nofollowFilter, spamFilter, drMin, drMax, trafficMin, trafficMax, firstSeenFrom, firstSeenTo, sortParam]);

  // Debounce: input → drilldownPath
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDrilldownPath(targetPathInput || null);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [targetPathInput]);

  // Debounce: domainInput → domainFilter
  useEffect(() => {
    clearTimeout(domainDebounceRef.current);
    domainDebounceRef.current = setTimeout(() => {
      setDomainFilter(domainInput || null);
    }, 300);
    return () => clearTimeout(domainDebounceRef.current);
  }, [domainInput]);

  // Debounce: urlInput → urlFilter
  useEffect(() => {
    clearTimeout(urlDebounceRef.current);
    urlDebounceRef.current = setTimeout(() => {
      setUrlFilter(urlInput || null);
    }, 300);
    return () => clearTimeout(urlDebounceRef.current);
  }, [urlInput]);

  // Debounce: anchorInput → anchorFilter
  useEffect(() => {
    clearTimeout(anchorDebounceRef.current);
    anchorDebounceRef.current = setTimeout(() => {
      setAnchorFilter(anchorInput || null);
    }, 300);
    return () => clearTimeout(anchorDebounceRef.current);
  }, [anchorInput]);

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
    setExactMatch(true);
    setTab("links");
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
      setSpamFilter("");
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
              <SummaryCard label="Total Backlinks" value={(overview.total_backlinks ?? 0).toLocaleString()} />
              <SummaryCard label="Referring Domains" value={(overview.unique_referring_domains ?? 0).toLocaleString()} />
              <SummaryCard label="Dofollow" value={(overview.dofollow_count ?? 0).toLocaleString()} color="text-green-600" />
              <SummaryCard label="Avg DR" value={overview.avg_dr?.toFixed(1) ?? "—"} />
              <SummaryCard label="Nofollow" value={(overview.nofollow_count ?? 0).toLocaleString()} />
              <SummaryCard label="Spam Ratio" value={`${((overview.spam_ratio ?? 0) * 100).toFixed(1)}%`} color={(overview.spam_ratio ?? 0) > 0.1 ? "text-red-600" : "text-green-600"} />
              <SummaryCard label="Image Links" value={(overview.image_link_count ?? 0).toLocaleString()} />
              <SummaryCard label="Total Backlink Traffic" value={(overview.total_page_traffic ?? 0).toLocaleString()} />
              <SummaryCard label="Newest Backlink" value={overview.newest_backlink_date ? new Date(overview.newest_backlink_date).toLocaleDateString() : "—"} />
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
              <div className="flex min-w-[180px] max-w-xs flex-1">
                <button
                  onClick={() => setDomainExclude((v) => !v)}
                  className={`px-2 py-2 text-sm font-medium border rounded-l-md transition-colors ${
                    domainExclude
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100"
                  }`}
                  title={domainExclude ? "Excluding — click to include" : "Including — click to exclude"}
                >{domainExclude ? "\u2212" : "+"}</button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={domainExclude ? "Exclude referring domain..." : "Filter by referring domain..."}
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    className={`w-full border border-l-0 rounded-r-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      domainExclude ? "border-red-300" : "border-gray-300"
                    }`}
                  />
                  {domainInput && (
                    <button
                      onClick={() => { setDomainInput(""); setDomainFilter(null); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                    >&#x2715;</button>
                  )}
                </div>
              </div>
              <div className="flex min-w-[180px] max-w-xs flex-1">
                <button
                  onClick={() => setUrlExclude((v) => !v)}
                  className={`px-2 py-2 text-sm font-medium border rounded-l-md transition-colors ${
                    urlExclude
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100"
                  }`}
                  title={urlExclude ? "Excluding — click to include" : "Including — click to exclude"}
                >{urlExclude ? "\u2212" : "+"}</button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={urlExclude ? "Exclude referring URL..." : "Filter by referring URL..."}
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className={`w-full border border-l-0 rounded-r-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      urlExclude ? "border-red-300" : "border-gray-300"
                    }`}
                  />
                  {urlInput && (
                    <button
                      onClick={() => { setUrlInput(""); setUrlFilter(null); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                    >&#x2715;</button>
                  )}
                </div>
              </div>
              <div className="flex min-w-[180px] max-w-xs flex-1">
                <button
                  onClick={() => setTargetPathExclude((v) => !v)}
                  className={`px-2 py-2 text-sm font-medium border rounded-l-md transition-colors ${
                    targetPathExclude
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100"
                  }`}
                  title={targetPathExclude ? "Excluding — click to include" : "Including — click to exclude"}
                >{targetPathExclude ? "\u2212" : "+"}</button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={targetPathExclude ? "Exclude target URL..." : "Filter by target URL..."}
                    value={targetPathInput}
                    onChange={(e) => setTargetPathInput(e.target.value)}
                    className={`w-full border border-l-0 rounded-r-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      targetPathExclude ? "border-red-300" : "border-gray-300"
                    }`}
                  />
                  {targetPathInput && (
                    <button
                      onClick={() => { setTargetPathInput(""); setDrilldownPath(null); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                    >&#x2715;</button>
                  )}
                </div>
              </div>
              <div className="flex min-w-[180px] max-w-xs flex-1">
                <button
                  onClick={() => setAnchorExclude((v) => !v)}
                  className={`px-2 py-2 text-sm font-medium border rounded-l-md transition-colors ${
                    anchorExclude
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100"
                  }`}
                  title={anchorExclude ? "Excluding — click to include" : "Including — click to exclude"}
                >{anchorExclude ? "\u2212" : "+"}</button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={anchorExclude ? "Exclude anchor..." : "Filter by anchor..."}
                    value={anchorInput}
                    onChange={(e) => setAnchorInput(e.target.value)}
                    className={`w-full border border-l-0 rounded-r-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      anchorExclude ? "border-red-300" : "border-gray-300"
                    }`}
                  />
                  {anchorInput && (
                    <button
                      onClick={() => { setAnchorInput(""); setAnchorFilter(null); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                    >&#x2715;</button>
                  )}
                </div>
              </div>
              <button
                onClick={() => setExactMatch((v) => !v)}
                className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                  exactMatch
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
                title={exactMatch ? "Exact match enabled — click to switch to contains" : "Contains match — click to switch to exact match"}
              >
                {exactMatch ? "Exact" : "Contains"}
              </button>
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
                value={spamFilter}
                onChange={(e) => setSpamFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Spam: All</option>
                <option value="yes">Spam: Yes</option>
                <option value="no">Spam: No</option>
              </select>
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
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Referring Domains</h3>
              <ExportButton data={domains as unknown as Record<string, unknown>[]} filename="referring-domains.csv" />
            </div>
            <DataTable data={domains} columns={domainColumns} />
          </div>
        )}

        {tab === "anchors" && (
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Anchor Text Distribution</h3>
              <ExportButton data={anchors as unknown as Record<string, unknown>[]} filename="anchors.csv" />
            </div>
            <DataTable data={anchors} columns={anchorColumns} />
          </div>
        )}

        {tab === "pages" && (
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
        )}

        {tab === "quality" && (
          <div className="bg-white rounded-lg shadow p-5">
            <ScatterPlot data={quality} />
          </div>
        )}

        {tab === "compare" && <CompareTab />}
      </main>
    </div>
  );
}

export default Dashboard;
