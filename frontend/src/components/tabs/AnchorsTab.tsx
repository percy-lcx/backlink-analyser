import { useState, useEffect, useCallback } from "react";
import {
  fetchAnchors,
  type AnchorRecord,
  type MatchMode,
  type LinksDrilldown,
} from "../../lib/api";
import { useSessionFilters } from "../../lib/useSessionFilters";
import { anchorColumns } from "../../lib/columns";
import DataTable from "../tables/DataTable";
import ExportButton from "../tables/ExportButton";
import FilterInput from "../FilterInput";
import LoadingSpinner from "../LoadingSpinner";
import EmptyState from "../EmptyState";
import { FilterPanel, RangeFilter, SelectFilter } from "../filters";

interface AnchorsTabProps {
  profile: string;
  onDrilldown: (d: LinksDrilldown) => void;
}

export default function AnchorsTab({ profile, onDrilldown }: AnchorsTabProps) {
  const [anchors, setAnchors] = useState<AnchorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<MatchMode>("contains");
  const [searchExclude, setSearchExclude] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [countMin, setCountMin] = useState("");
  const [countMax, setCountMax] = useState("");

  const setSearchFilterCb = useCallback((v: string | null) => setSearchFilter(v), []);

  const clearFilters = useCallback(() => {
    setSearchInput(""); setSearchFilter(null); setSearchMode("contains"); setSearchExclude(false);
    setCategoryFilter(""); setCountMin(""); setCountMax("");
  }, []);

  // Session filter persistence
  const getFilters = useCallback(() => ({
    searchInput, searchMode, searchExclude: String(searchExclude),
    categoryFilter, countMin, countMax,
  }), [searchInput, searchMode, searchExclude, categoryFilter, countMin, countMax]);

  const applyFilters = useCallback((f: Record<string, string>) => {
    if (f.searchInput) { setSearchInput(f.searchInput); setSearchFilter(f.searchInput); }
    if (f.searchMode) setSearchMode(f.searchMode as MatchMode);
    if (f.searchExclude) setSearchExclude(f.searchExclude === "true");
    if (f.categoryFilter) setCategoryFilter(f.categoryFilter);
    if (f.countMin) setCountMin(f.countMin);
    if (f.countMax) setCountMax(f.countMax);
  }, []);

  const { loaded: sessionLoaded, save: saveSession } = useSessionFilters(
    profile, "anchors", getFilters, applyFilters,
  );

  useEffect(() => {
    if (!sessionLoaded) return;
    saveSession();
    setLoading(true);
    const params: Record<string, string | number | boolean | undefined> = {};
    if (searchFilter) {
      params.anchor_search = searchFilter;
      if (searchMode !== "contains") params.anchor_mode = searchMode;
      if (searchExclude) params.anchor_exclude = true;
    }
    if (categoryFilter) params.category = categoryFilter;
    if (countMin) params.count_min = parseInt(countMin);
    if (countMax) params.count_max = parseInt(countMax);
    fetchAnchors(profile, params)
      .then((data) => {
        const items = Array.isArray(data) ? data : (data as { items: AnchorRecord[] }).items ?? [];
        const total = items.reduce((s, a) => s + a.count, 0);
        setAnchors(items.map((a) => ({ ...a, pct: total > 0 ? (a.count / total) * 100 : 0 })));
      })
      .catch(() => setAnchors([]))
      .finally(() => setLoading(false));
  }, [profile, searchFilter, searchMode, searchExclude, categoryFilter, countMin, countMax, sessionLoaded, saveSession]);

  const handleRowClick = (row: AnchorRecord) => {
    onDrilldown({ anchor: row.anchor });
  };

  const activeCount = [searchFilter, categoryFilter, countMin, countMax].filter(Boolean).length;

  return (
    <div>
      <FilterPanel activeCount={activeCount} onClear={clearFilters}>
        <div className="flex items-center gap-3 flex-wrap">
          <FilterInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Filter by anchor text..."
            exclude={searchExclude}
            onExcludeChange={setSearchExclude}
            matchMode={searchMode}
            onMatchModeChange={setSearchMode}
            onDebouncedChange={setSearchFilterCb}
          />
          <SelectFilter
            value={categoryFilter}
            onChange={setCategoryFilter}
            allLabel="Category: All"
            options={[
              { value: "branded", label: "Branded" },
              { value: "exact_match", label: "Exact Match" },
              { value: "partial_match", label: "Partial Match" },
              { value: "naked_url", label: "Naked URL" },
              { value: "generic", label: "Generic" },
              { value: "image", label: "Image" },
              { value: "other", label: "Other" },
            ]}
          />
          <RangeFilter label="Count" min={countMin} max={countMax} onMinChange={setCountMin} onMaxChange={setCountMax} />
        </div>
      </FilterPanel>

      {loading ? (
        <LoadingSpinner message="Loading anchors..." />
      ) : anchors.length === 0 ? (
        <EmptyState title="No anchor text data found" description="Try adjusting your filters." />
      ) : (
        <div className="bg-white rounded-lg shadow p-5">
          <DataTable data={anchors} columns={anchorColumns} onRowClick={handleRowClick} statusText={<div><h3 className="text-sm font-semibold text-gray-700">Anchor Text Distribution</h3><p className="text-xs text-gray-400 mt-1">Click any row to see all backlinks with that anchor text.</p></div>} toolbar={<ExportButton data={anchors as unknown as Record<string, unknown>[]} filename="anchors.csv" />} />
        </div>
      )}
    </div>
  );
}
