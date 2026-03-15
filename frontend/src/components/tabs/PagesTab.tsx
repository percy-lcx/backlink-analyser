import { useState, useEffect, useCallback } from "react";
import {
  fetchPageBreakdown,
  type PageRow,
  type PageBreakdownResponse,
  type LinksDrilldown,
  type MatchMode,
} from "../../lib/api";
import { pageColumns } from "../../lib/columns";
import DataTable from "../tables/DataTable";
import ExportButton from "../tables/ExportButton";
import FilterInput from "../FilterInput";
import SummaryCard from "../SummaryCard";
import PageCategoryChart from "../charts/PageCategoryChart";
import TopPagesChart from "../charts/TopPagesChart";
import LoadingSpinner from "../LoadingSpinner";
import EmptyState from "../EmptyState";
import { FilterPanel, FilterGroup, RangeFilter, SelectFilter } from "../filters";
import { METRICS } from "../../lib/metrics";

interface PagesTabProps {
  profile: string;
  onDrilldown: (d: LinksDrilldown) => void;
}

export default function PagesTab({ profile, onDrilldown }: PagesTabProps) {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [pageCategories, setPageCategories] = useState<PageBreakdownResponse["categories"]>({});
  const [loading, setLoading] = useState(true);
  const [pathInput, setPathInput] = useState("");
  const [pathFilter, setPathFilter] = useState<string | null>(null);
  const [pathExclude, setPathExclude] = useState(false);
  const [pathMode, setPathMode] = useState<MatchMode>("contains");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [linksMin, setLinksMin] = useState("");
  const [linksMax, setLinksMax] = useState("");
  const [domainsMin, setDomainsMin] = useState("");
  const [domainsMax, setDomainsMax] = useState("");
  const [drMin, setDrMin] = useState("");
  const [drMax, setDrMax] = useState("");
  const [dofollowMin, setDofollowMin] = useState("");
  const [dofollowMax, setDofollowMax] = useState("");

  const setPathFilterCb = useCallback((v: string | null) => setPathFilter(v), []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string | number | boolean | undefined> = {};
    if (pathFilter) {
      params.target_path_search = pathFilter;
      if (pathExclude) params.target_path_exclude = true;
      if (pathMode !== "contains") params.target_path_mode = pathMode;
    }
    if (categoryFilter) params.category = categoryFilter;
    if (linksMin) params.link_count_min = parseInt(linksMin);
    if (linksMax) params.link_count_max = parseInt(linksMax);
    if (domainsMin) params.ref_domains_min = parseInt(domainsMin);
    if (domainsMax) params.ref_domains_max = parseInt(domainsMax);
    if (drMin) params.avg_dr_min = parseFloat(drMin);
    if (drMax) params.avg_dr_max = parseFloat(drMax);
    if (dofollowMin) params.dofollow_min = parseFloat(dofollowMin) / 100;
    if (dofollowMax) params.dofollow_max = parseFloat(dofollowMax) / 100;
    fetchPageBreakdown(profile, params)
      .then((data) => {
        const items = Array.isArray(data) ? data : (data as { pages: PageRow[] }).pages ?? [];
        setPages(items);
        setPageCategories((data as PageBreakdownResponse).categories ?? {});
      })
      .catch(() => { setPages([]); setPageCategories({}); })
      .finally(() => setLoading(false));
  }, [profile, pathFilter, pathExclude, pathMode, categoryFilter, linksMin, linksMax, domainsMin, domainsMax, drMin, drMax, dofollowMin, dofollowMax]);

  const handleRowClick = (row: PageRow) => {
    onDrilldown({ targetPath: row.target_path, targetPathMode: "exact" });
  };

  const activeCount = [pathFilter, categoryFilter, linksMin, linksMax, domainsMin, domainsMax, drMin, drMax, dofollowMin, dofollowMax].filter(Boolean).length
    + (pathExclude ? 1 : 0);

  return (
    <div>
      <FilterPanel activeCount={activeCount}>
        <FilterGroup label="Search">
          <FilterInput
            value={pathInput}
            onChange={setPathInput}
            placeholder="Filter by target URL..."
            excludePlaceholder="Exclude target URL..."
            exclude={pathExclude}
            onExcludeChange={setPathExclude}
            matchMode={pathMode}
            onMatchModeChange={setPathMode}
            onDebouncedChange={setPathFilterCb}
          />
          <SelectFilter
            value={categoryFilter}
            onChange={setCategoryFilter}
            allLabel="Category: All"
            options={[
              { value: "homepage", label: "Homepage" },
              { value: "content", label: "Content" },
              { value: "money_pages", label: "Money Pages" },
              { value: "branding", label: "Branding" },
              { value: "other", label: "Other" },
            ]}
          />
        </FilterGroup>
        <FilterGroup label="Metrics">
          <RangeFilter label="Backlinks" min={linksMin} max={linksMax} onMinChange={setLinksMin} onMaxChange={setLinksMax} />
          <RangeFilter label="Ref. Domains" min={domainsMin} max={domainsMax} onMinChange={setDomainsMin} onMaxChange={setDomainsMax} />
          <RangeFilter label="Avg DR" min={drMin} max={drMax} onMinChange={setDrMin} onMaxChange={setDrMax} />
          <RangeFilter label="Dofollow %" min={dofollowMin} max={dofollowMax} onMinChange={setDofollowMin} onMaxChange={setDofollowMax} />
        </FilterGroup>
      </FilterPanel>

      {loading ? (
        <LoadingSpinner message="Loading pages..." />
      ) : pages.length === 0 ? (
        <EmptyState title="No pages found" description="Try adjusting your filters." />
      ) : (
        <div className="space-y-6">
          {(() => {
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PageCategoryChart
              data={Object.entries(pageCategories).map(([category, d]) => ({ category, link_count: d.link_count }))}
              onBarClick={(category) => setCategoryFilter(category)}
            />
            <TopPagesChart
              data={pages}
              onBarClick={(targetPath) => handleRowClick({ target_path: targetPath } as PageRow)}
            />
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Backlinks by Target Page</h3>
                <p className="text-xs text-gray-400 mt-1">Click any row to see all backlinks pointing to that URL.</p>
              </div>
              <ExportButton data={pages as unknown as Record<string, unknown>[]} filename="pages.csv" />
            </div>
            <DataTable data={pages} columns={pageColumns} onRowClick={handleRowClick} />
          </div>
        </div>
      )}
    </div>
  );
}
