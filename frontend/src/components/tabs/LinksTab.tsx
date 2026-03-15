import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchLinks,
  fetchHttpCodes,
  type LinksResponse,
  type MatchMode,
  type LinksDrilldown,
} from "../../lib/api";
import { useSessionFilters } from "../../lib/useSessionFilters";
import { linkColumns } from "../../lib/columns";
import DataTable, { type SortingState } from "../tables/DataTable";
import ExportButton from "../tables/ExportButton";
import FilterInput from "../FilterInput";
import LoadingSpinner from "../LoadingSpinner";
import EmptyState from "../EmptyState";
import { FilterPanel, FilterGroup, RangeFilter, SelectFilter, DateRangeFilter } from "../filters";

interface LinksTabProps {
  profile: string;
  drilldown: LinksDrilldown | null;
}

export default function LinksTab({ profile, drilldown }: LinksTabProps) {
  const [linksData, setLinksData] = useState<LinksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkPage, setLinkPage] = useState(0);
  const [linkPageSize, setLinkPageSize] = useState(100);

  // Text filters – initialise from drilldown so the first fetch is already filtered
  const [targetPathInput, setTargetPathInput] = useState(drilldown?.targetPath ?? "");
  const [drilldownPath, setDrilldownPath] = useState<string | null>(drilldown?.targetPath ?? null);
  const [targetPathExclude, setTargetPathExclude] = useState(false);
  const [targetPathMode, setTargetPathMode] = useState<MatchMode>(drilldown?.targetPathMode ?? "contains");
  const [domainInput, setDomainInput] = useState(drilldown?.domain ?? "");
  const [domainFilter, setDomainFilter] = useState<string | null>(drilldown?.domain ?? null);
  const [domainExclude, setDomainExclude] = useState(false);
  const [domainMode, setDomainMode] = useState<MatchMode>(drilldown?.domainMode ?? "contains");
  const [urlInput, setUrlInput] = useState("");
  const [urlFilter, setUrlFilter] = useState<string | null>(null);
  const [urlExclude, setUrlExclude] = useState(false);
  const [urlMode, setUrlMode] = useState<MatchMode>("contains");
  const [anchorInput, setAnchorInput] = useState(drilldown?.anchor ?? "");
  const [anchorFilter, setAnchorFilter] = useState<string | null>(drilldown?.anchor ?? null);
  const [anchorExclude, setAnchorExclude] = useState(false);
  const [anchorMode, setAnchorMode] = useState<MatchMode>(drilldown?.anchorMode ?? "contains");

  // Property filters
  const [linkTypeFilter, setLinkTypeFilter] = useState("");
  const [nofollowFilter, setNofollowFilter] = useState("");
  const [sponsoredFilter, setSponsoredFilter] = useState("");
  const [spamFilter, setSpamFilter] = useState("");
  const [httpCodeFilter, setHttpCodeFilter] = useState<string[]>([]);
  const [httpCodes, setHttpCodes] = useState<number[]>([]);
  const [httpDropdownOpen, setHttpDropdownOpen] = useState(false);
  const httpDropdownRef = useRef<HTMLDivElement>(null);
  const httpCodeFilterKey = httpCodeFilter.join(",");

  // Range filters
  const [drMin, setDrMin] = useState(drilldown?.drMin ?? "");
  const [drMax, setDrMax] = useState(drilldown?.drMax ?? "");
  const [trafficMin, setTrafficMin] = useState("");
  const [trafficMax, setTrafficMax] = useState("");
  const [firstSeenFrom, setFirstSeenFrom] = useState("");
  const [firstSeenTo, setFirstSeenTo] = useState("");

  const [sortParam, setSortParam] = useState("domain_rating:desc");

  // Stable callbacks
  const setDrilldownPathCb = useCallback((v: string | null) => setDrilldownPath(v), []);
  const setDomainFilterCb = useCallback((v: string | null) => setDomainFilter(v), []);
  const setUrlFilterCb = useCallback((v: string | null) => setUrlFilter(v), []);
  const setAnchorFilterCb = useCallback((v: string | null) => setAnchorFilter(v), []);

  const clearFilters = useCallback(() => {
    setTargetPathInput(""); setDrilldownPath(null); setTargetPathExclude(false); setTargetPathMode("contains");
    setDomainInput(""); setDomainFilter(null); setDomainExclude(false); setDomainMode("contains");
    setUrlInput(""); setUrlFilter(null); setUrlExclude(false); setUrlMode("contains");
    setAnchorInput(""); setAnchorFilter(null); setAnchorExclude(false); setAnchorMode("contains");
    setLinkTypeFilter(""); setNofollowFilter(""); setSponsoredFilter(""); setSpamFilter(""); setHttpCodeFilter([]);
    setDrMin(""); setDrMax(""); setTrafficMin(""); setTrafficMax("");
    setFirstSeenFrom(""); setFirstSeenTo("");
  }, []);

  // Session filter persistence
  const getFilters = useCallback(() => ({
    targetPathInput, targetPathMode, targetPathExclude: String(targetPathExclude),
    domainInput, domainMode, domainExclude: String(domainExclude),
    urlInput, urlMode, urlExclude: String(urlExclude),
    anchorInput, anchorMode, anchorExclude: String(anchorExclude),
    linkTypeFilter, nofollowFilter, sponsoredFilter, spamFilter,
    httpCodeFilter: httpCodeFilter.join(","),
    drMin, drMax, trafficMin, trafficMax, firstSeenFrom, firstSeenTo,
  }), [targetPathInput, targetPathMode, targetPathExclude, domainInput, domainMode, domainExclude, urlInput, urlMode, urlExclude, anchorInput, anchorMode, anchorExclude, linkTypeFilter, nofollowFilter, sponsoredFilter, spamFilter, httpCodeFilter, drMin, drMax, trafficMin, trafficMax, firstSeenFrom, firstSeenTo]);

  const applyFilters = useCallback((f: Record<string, string>) => {
    if (f.targetPathInput) { setTargetPathInput(f.targetPathInput); setDrilldownPath(f.targetPathInput); }
    if (f.targetPathMode) setTargetPathMode(f.targetPathMode as MatchMode);
    if (f.targetPathExclude) setTargetPathExclude(f.targetPathExclude === "true");
    if (f.domainInput) { setDomainInput(f.domainInput); setDomainFilter(f.domainInput); }
    if (f.domainMode) setDomainMode(f.domainMode as MatchMode);
    if (f.domainExclude) setDomainExclude(f.domainExclude === "true");
    if (f.urlInput) { setUrlInput(f.urlInput); setUrlFilter(f.urlInput); }
    if (f.urlMode) setUrlMode(f.urlMode as MatchMode);
    if (f.urlExclude) setUrlExclude(f.urlExclude === "true");
    if (f.anchorInput) { setAnchorInput(f.anchorInput); setAnchorFilter(f.anchorInput); }
    if (f.anchorMode) setAnchorMode(f.anchorMode as MatchMode);
    if (f.anchorExclude) setAnchorExclude(f.anchorExclude === "true");
    if (f.linkTypeFilter) setLinkTypeFilter(f.linkTypeFilter);
    if (f.nofollowFilter) setNofollowFilter(f.nofollowFilter);
    if (f.sponsoredFilter) setSponsoredFilter(f.sponsoredFilter);
    if (f.spamFilter) setSpamFilter(f.spamFilter);
    if (f.httpCodeFilter) setHttpCodeFilter(f.httpCodeFilter.split(",").filter(Boolean));
    if (f.drMin) setDrMin(f.drMin);
    if (f.drMax) setDrMax(f.drMax);
    if (f.trafficMin) setTrafficMin(f.trafficMin);
    if (f.trafficMax) setTrafficMax(f.trafficMax);
    if (f.firstSeenFrom) setFirstSeenFrom(f.firstSeenFrom);
    if (f.firstSeenTo) setFirstSeenTo(f.firstSeenTo);
  }, []);

  const { loaded: sessionLoaded, save: saveSession } = useSessionFilters(
    profile, "links", getFilters, applyFilters, !!drilldown,
  );

  // Apply drilldown from parent
  const prevDrilldown = useRef(drilldown);
  useEffect(() => {
    if (drilldown === prevDrilldown.current) return;
    prevDrilldown.current = drilldown;

    if (drilldown === null) {
      clearFilters();
      return;
    }

    if (drilldown.domain) {
      setDomainInput(drilldown.domain);
      setDomainFilter(drilldown.domain);
      if (drilldown.domainMode) setDomainMode(drilldown.domainMode);
    }
    if (drilldown.anchor) {
      setAnchorInput(drilldown.anchor);
      setAnchorFilter(drilldown.anchor);
      if (drilldown.anchorMode) setAnchorMode(drilldown.anchorMode);
    }
    if (drilldown.targetPath) {
      setTargetPathInput(drilldown.targetPath);
      setDrilldownPath(drilldown.targetPath);
      if (drilldown.targetPathMode) setTargetPathMode(drilldown.targetPathMode);
    }
    if (drilldown.drMin) setDrMin(drilldown.drMin);
    if (drilldown.drMax) setDrMax(drilldown.drMax);
  }, [drilldown]);

  // Fetch available HTTP status codes
  useEffect(() => {
    fetchHttpCodes(profile).then((r) => setHttpCodes(r.codes ?? [])).catch(() => setHttpCodes([]));
  }, [profile]);

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

  // Fetch data
  useEffect(() => {
    if (!sessionLoaded) return;
    saveSession();
    setLoading(true);
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
    fetchLinks(profile, params as Parameters<typeof fetchLinks>[1])
      .then(setLinksData)
      .catch(() => setLinksData(null))
      .finally(() => setLoading(false));
  }, [profile, linkPage, linkPageSize, sortParam, drilldownPath, targetPathMode, targetPathExclude, domainFilter, domainMode, domainExclude, urlFilter, urlMode, urlExclude, anchorFilter, anchorMode, anchorExclude, linkTypeFilter, nofollowFilter, sponsoredFilter, spamFilter, httpCodeFilterKey, drMin, drMax, trafficMin, trafficMax, firstSeenFrom, firstSeenTo, sessionLoaded, saveSession]);

  // Reset page on filter change
  useEffect(() => {
    setLinkPage(0);
  }, [drilldownPath, domainFilter, urlFilter, anchorFilter, linkTypeFilter, nofollowFilter, sponsoredFilter, spamFilter, httpCodeFilterKey, drMin, drMax, trafficMin, trafficMax, firstSeenFrom, firstSeenTo, sortParam]);

  const handleSortChange = (sorting: SortingState) => {
    if (sorting.length > 0) {
      setSortParam(`${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`);
    } else {
      setSortParam("domain_rating:desc");
    }
  };

  const activeCount = [
    drilldownPath, domainFilter, urlFilter, anchorFilter,
    linkTypeFilter, nofollowFilter, sponsoredFilter, spamFilter,
    drMin, drMax, trafficMin, trafficMax, firstSeenFrom, firstSeenTo,
  ].filter(Boolean).length
    + (httpCodeFilter.length > 0 ? 1 : 0)
    + (targetPathExclude ? 1 : 0) + (domainExclude ? 1 : 0) + (urlExclude ? 1 : 0) + (anchorExclude ? 1 : 0);

  return (
    <div>
      <FilterPanel activeCount={activeCount} onClear={clearFilters}>
        <FilterGroup label="Text Search">
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
        </FilterGroup>
        <FilterGroup label="Link Properties">
          <SelectFilter
            value={linkTypeFilter}
            onChange={setLinkTypeFilter}
            allLabel="All Types"
            options={[
              { value: "dofollow", label: "Dofollow" },
              { value: "nofollow", label: "Nofollow" },
              { value: "ugc", label: "UGC" },
              { value: "sponsored", label: "Sponsored" },
              { value: "image", label: "Image" },
            ]}
          />
          <SelectFilter
            value={nofollowFilter}
            onChange={setNofollowFilter}
            allLabel="Nofollow: All"
            options={[
              { value: "yes", label: "Nofollow: Yes" },
              { value: "no", label: "Nofollow: No" },
            ]}
          />
          <SelectFilter
            value={sponsoredFilter}
            onChange={setSponsoredFilter}
            allLabel="Sponsored: All"
            options={[
              { value: "yes", label: "Sponsored: Yes" },
              { value: "no", label: "Sponsored: No" },
            ]}
          />
          <SelectFilter
            value={spamFilter}
            onChange={setSpamFilter}
            allLabel="Spam: All"
            options={[
              { value: "yes", label: "Spam: Yes" },
              { value: "no", label: "Spam: No" },
            ]}
          />
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
        </FilterGroup>
        <FilterGroup label="Metrics">
          <RangeFilter label="DR" min={drMin} max={drMax} onMinChange={setDrMin} onMaxChange={setDrMax} />
          <RangeFilter label="Traffic" min={trafficMin} max={trafficMax} onMinChange={setTrafficMin} onMaxChange={setTrafficMax} inputWidth="w-20" />
          <DateRangeFilter label="First Seen" from={firstSeenFrom} to={firstSeenTo} onFromChange={setFirstSeenFrom} onToChange={setFirstSeenTo} />
        </FilterGroup>
      </FilterPanel>

      {linksData && (
        <div className="mb-3 text-sm text-gray-400">
          {linksData.total.toLocaleString()} backlinks
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading backlinks..." />
      ) : !linksData || linksData.items.length === 0 ? (
        <EmptyState title="No backlinks found" description="Try adjusting your filters." />
      ) : (
        <div className="bg-white rounded-lg shadow p-5">
          <DataTable
            toolbar={<ExportButton data={(linksData.items) as unknown as Record<string, unknown>[]} filename="backlinks.csv" />}
            data={linksData.items}
            columns={linkColumns}
            pageSize={linkPageSize}
            manualPagination
            manualSorting
            onSortChange={handleSortChange}
            pageCount={Math.ceil(linksData.total / linkPageSize)}
            pageIndex={linkPage}
            onPageChange={setLinkPage}
            onPageSizeChange={setLinkPageSize}
          />
        </div>
      )}
    </div>
  );
}
