import { useState, useEffect, useCallback, useRef } from "react";
import { useProfile } from "./ProfileContext";
import SummaryCard from "./SummaryCard";
import DataTable, { type SortingState } from "./tables/DataTable";
import ExportButton from "./tables/ExportButton";
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
  {
    accessorKey: "page_traffic",
    header: "Page Traffic",
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? v.toLocaleString() : "—";
    },
  },
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
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [codesDropdownOpen, setCodesDropdownOpen] = useState(false);
  const codesDropdownRef = useRef<HTMLDivElement>(null);
  const selectedCodesKey = selectedCodes.join(",");
  const [drMin, setDrMin] = useState("");
  const [drMax, setDrMax] = useState("");

  // Close codes dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (codesDropdownRef.current && !codesDropdownRef.current.contains(e.target as Node)) {
        setCodesDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [debouncedDomain, domainMode, domainExclude, selectedCodesKey, drMin, drMax, sortParam]);

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
      http_code: selectedCodesKey || undefined,
      dr_min: drMin ? Number(drMin) : undefined,
      dr_max: drMax ? Number(drMax) : undefined,
    })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selected, page, pageSize, sortParam, debouncedDomain, domainMode, domainExclude, selectedCodesKey, drMin, drMax]);

  const handleSortChange = (sorting: SortingState) => {
    if (sorting.length > 0) {
      setSortParam(`${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`);
    } else {
      setSortParam("domain_rating:desc");
    }
  };

  const setDebouncedDomainCb = useCallback((v: string | null) => setDebouncedDomain(v), []);

  const handleBarClick = (entry: { http_code: number }) => {
    const code = String(entry.http_code);
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
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
            {selectedCodes.length > 0 && (
              <button
                className="text-xs text-indigo-600 hover:text-indigo-800"
                onClick={() => setSelectedCodes([])}
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
                    opacity={selectedCodes.length > 0 && !selectedCodes.includes(String(entry.http_code)) ? 0.3 : 1}
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
        <div className="relative" ref={codesDropdownRef}>
          <button
            type="button"
            onClick={() => setCodesDropdownOpen((o) => !o)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-1"
          >
            {selectedCodes.length === 0 ? "Status: All" : `Status: ${selectedCodes.join(", ")}`}
            <svg className="w-3 h-3 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {codesDropdownOpen && (
            <div className="absolute z-10 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto min-w-[140px]">
              {distribution.map((d) => (
                <label key={d.http_code} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selectedCodes.includes(String(d.http_code))}
                    onChange={(e) => {
                      const code = String(d.http_code);
                      setSelectedCodes((prev) =>
                        e.target.checked
                          ? [...prev, code]
                          : prev.filter((c) => c !== code)
                      );
                    }}
                    className="rounded border-gray-300"
                  />
                  {d.http_code} ({d.count})
                </label>
              ))}
              {distribution.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">No status codes</div>
              )}
            </div>
          )}
        </div>
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
        <>
        <DataTable
          toolbar={<ExportButton data={data.items as unknown as Record<string, unknown>[]} filename="broken-links.csv" />}
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
        </>
      )}
    </div>
  );
}
