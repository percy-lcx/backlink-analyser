import { useState, useEffect, useCallback } from "react";
import { useProfile } from "./ProfileContext";
import SummaryCard from "./SummaryCard";
import DataTable, { type SortingState } from "./tables/DataTable";
import FilterInput from "./FilterInput";
import {
  fetchBrokenLinks,
  type BrokenLinksResponse,
  type LinkRecord,
  type MatchMode,
} from "../lib/api";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const columns: ColumnDef<LinkRecord, unknown>[] = [
  { accessorKey: "referring_domain", header: "Referring Domain" },
  {
    accessorKey: "referring_url",
    header: "Referring URL",
    size: 400,
    cell: ({ getValue }) => {
      const url = getValue() as string;
      return (
        <a href={url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline truncate block">
          {url}
        </a>
      );
    },
  },
  { accessorKey: "target_path", header: "Target Path" },
  {
    accessorKey: "http_code",
    header: "Status",
    cell: ({ getValue }) => {
      const code = getValue() as number;
      const color = code >= 500 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
      return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{code}</span>;
    },
  },
  { accessorKey: "domain_rating", header: "DR" },
  { accessorKey: "anchor", header: "Anchor" },
  {
    accessorKey: "first_seen",
    header: "First Seen",
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? new Date(v).toLocaleDateString() : "—";
    },
  },
  {
    accessorKey: "last_seen",
    header: "Last Seen",
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? new Date(v).toLocaleDateString() : "—";
    },
  },
];

export default function BrokenLinksTab() {
  const { selected } = useProfile();
  const [data, setData] = useState<BrokenLinksResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Pagination & sorting
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [sortParam, setSortParam] = useState("domain_rating:desc");

  // Filters
  const [domainSearch, setDomainSearch] = useState("");
  const [debouncedDomain, setDebouncedDomain] = useState<string | null>(null);
  const [domainMode, setDomainMode] = useState<MatchMode>("contains");
  const [domainExclude, setDomainExclude] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [drMin, setDrMin] = useState("");
  const [drMax, setDrMax] = useState("");

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [debouncedDomain, domainMode, domainExclude, selectedCode, drMin, drMax, sortParam]);

  // Fetch data
  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetchBrokenLinks(selected, {
      page: page + 1,
      per_page: pageSize,
      sort: sortParam,
      domain_search: debouncedDomain ?? undefined,
      domain_mode: domainMode,
      domain_exclude: domainExclude || undefined,
      http_code: selectedCode || undefined,
      dr_min: drMin ? Number(drMin) : undefined,
      dr_max: drMax ? Number(drMax) : undefined,
    })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selected, page, pageSize, sortParam, debouncedDomain, domainMode, domainExclude, selectedCode, drMin, drMax]);

  const handleSortChange = (sorting: SortingState) => {
    if (sorting.length > 0) {
      setSortParam(`${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`);
    } else {
      setSortParam("domain_rating:desc");
    }
  };

  const setDebouncedDomainCb = useCallback((v: string | null) => setDebouncedDomain(v), []);

  const handleBarClick = (entry: { http_code: number }) => {
    setSelectedCode(String(entry.http_code));
  };

  if (!selected) return null;

  const summary = data?.summary;
  const distribution = data?.distribution ?? [];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Broken"
          value={summary?.total_broken?.toLocaleString() ?? "—"}
          color="text-red-600"
          tooltip="Links returning HTTP 4xx or 5xx status codes"
        />
        <SummaryCard
          label="4xx Client Errors"
          value={summary?.count_4xx?.toLocaleString() ?? "—"}
          color="text-amber-600"
          tooltip="Links returning 400-499 status codes (not found, forbidden, etc.)"
        />
        <SummaryCard
          label="5xx Server Errors"
          value={summary?.count_5xx?.toLocaleString() ?? "—"}
          color="text-red-600"
          tooltip="Links returning 500-599 status codes (server errors)"
        />
        <SummaryCard
          label="Domains Affected"
          value={summary?.unique_domains_affected?.toLocaleString() ?? "—"}
          tooltip="Unique referring domains with broken links"
        />
      </div>

      {/* Distribution chart */}
      {distribution.length > 0 && (
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Status Code Distribution</h3>
            {selectedCode && (
              <button
                className="text-xs text-indigo-600 hover:text-indigo-800"
                onClick={() => setSelectedCode("")}
              >
                Show all codes
              </button>
            )}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="http_code" />
              <YAxis />
              <RechartsTooltip />
              <Bar
                dataKey="count"
                cursor="pointer"
                onClick={(_: unknown, index: number) => handleBarClick(distribution[index])}
              >
                {distribution.map((entry) => (
                  <Cell
                    key={entry.http_code}
                    fill={entry.http_code >= 500 ? "#dc2626" : "#d97706"}
                    opacity={selectedCode && String(entry.http_code) !== selectedCode ? 0.3 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <FilterInput
          value={domainSearch}
          onChange={setDomainSearch}
          placeholder="Filter by domain"
          exclude={domainExclude}
          onExcludeChange={setDomainExclude}
          matchMode={domainMode}
          onMatchModeChange={setDomainMode}
          onDebouncedChange={setDebouncedDomainCb}
        />
        <select
          className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
          value={selectedCode}
          onChange={(e) => setSelectedCode(e.target.value)}
        >
          <option value="">All status codes</option>
          {distribution.map((d) => (
            <option key={d.http_code} value={String(d.http_code)}>
              {d.http_code} ({d.count})
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="DR min"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-24"
          value={drMin}
          onChange={(e) => setDrMin(e.target.value)}
        />
        <input
          type="number"
          placeholder="DR max"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-24"
          value={drMax}
          onChange={(e) => setDrMax(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading && !data && <p className="text-sm text-gray-400">Loading...</p>}
      {data && data.summary.total_broken === 0 && (
        <div className="bg-white rounded-lg shadow p-10 text-center text-gray-400">
          No broken links found for this profile.
        </div>
      )}
      {data && data.summary.total_broken > 0 && (
        <DataTable
          data={data.items}
          columns={columns}
          pageSize={pageSize}
          manualPagination
          manualSorting
          onSortChange={handleSortChange}
          pageCount={Math.ceil(data.total / pageSize)}
          pageIndex={page}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
}
