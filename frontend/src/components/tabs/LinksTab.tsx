import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchLinks,
  type LinksResponse,
  type MatchMode,
  type LinksDrilldown,
} from "../../lib/api";
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

  // Text filters
  const [targetPathInput, setTargetPathInput] = useState("");
  const [drilldownPath, setDrilldownPath] = useState<string | null>(null);
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

  // Property filters
  const [linkTypeFilter, setLinkTypeFilter] = useState("");
  const [nofollowFilter, setNofollowFilter] = useState("");
  const [spamFilter, setSpamFilter] = useState("");

  // Range filters
  const [drMin, setDrMin] = useState("");
  const [drMax, setDrMax] = useState("");
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

  // Apply drilldown from parent
  const prevDrilldown = useRef(drilldown);
  useEffect(() => {
    if (drilldown === prevDrilldown.current) return;
    prevDrilldown.current = drilldown;

    if (drilldown === null) {
      // Clear all filters when clicking Links tab directly
      setTargetPathInput(""); setDrilldownPath(null); setTargetPathExclude(false); setTargetPathMode("contains");
      setDomainInput(""); setDomainFilter(null); setDomainExclude(false); setDomainMode("contains");
      setUrlInput(""); setUrlFilter(null); setUrlExclude(false); setUrlMode("contains");
      setAnchorInput(""); setAnchorFilter(null); setAnchorExclude(false); setAnchorMode("contains");
      setLinkTypeFilter(""); setNofollowFilter(""); setSpamFilter("");
      setDrMin(""); setDrMax(""); setTrafficMin(""); setTrafficMax("");
      setFirstSeenFrom(""); setFirstSeenTo("");
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

  // Fetch data
  useEffect(() => {
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
    if (spamFilter) params.is_spam = spamFilter === "yes";
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
  }, [profile, linkPage, linkPageSize, sortParam, drilldownPath, targetPathMode, targetPathExclude, domainFilter, domainMode, domainExclude, urlFilter, urlMode, urlExclude, anchorFilter, anchorMode, anchorExclude, linkTypeFilter, nofollowFilter, spamFilter, drMin, drMax, trafficMin, trafficMax, firstSeenFrom, firstSeenTo]);

  // Reset page on filter change
  useEffect(() => {
    setLinkPage(0);
  }, [drilldownPath, domainFilter, urlFilter, anchorFilter, linkTypeFilter, nofollowFilter, spamFilter, drMin, drMax, trafficMin, trafficMax, firstSeenFrom, firstSeenTo, sortParam]);

  const handleSortChange = (sorting: SortingState) => {
    if (sorting.length > 0) {
      setSortParam(`${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`);
    } else {
      setSortParam("domain_rating:desc");
    }
  };

  const activeCount = [
    drilldownPath, domainFilter, urlFilter, anchorFilter,
    linkTypeFilter, nofollowFilter, spamFilter,
    drMin, drMax, trafficMin, trafficMax, firstSeenFrom, firstSeenTo,
  ].filter(Boolean).length
    + (targetPathExclude ? 1 : 0) + (domainExclude ? 1 : 0) + (urlExclude ? 1 : 0) + (anchorExclude ? 1 : 0);

  return (
    <div>
      <FilterPanel activeCount={activeCount}>
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
            value={spamFilter}
            onChange={setSpamFilter}
            allLabel="Spam: All"
            options={[
              { value: "yes", label: "Spam: Yes" },
              { value: "no", label: "Spam: No" },
            ]}
          />
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
          <div className="flex justify-end mb-3">
            <ExportButton data={(linksData.items) as unknown as Record<string, unknown>[]} filename="backlinks.csv" />
          </div>
          <DataTable
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
