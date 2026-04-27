import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useProfile } from "./ProfileContext";
import { useBlocklist } from "./BlocklistContext";
import { useSessionFilters } from "../lib/useSessionFilters";
import DataTable from "./tables/DataTable";
import ExportButton from "./tables/ExportButton";
import {
  fetchLinkIntersect,
  fetchGapDomainBreakdown,
  type IntersectDomain,
  type IntersectResponse,
  type GapDomainBreakdownRow,
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

/* ---- Venn-style colour palette ---- */

const COLORS = [
  "#001489", // primary
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

function intersectColor(count: number, total: number): string {
  if (total === 0) return COLORS[0];
  // Stronger opportunities = all competitors → darker/more saturated
  const ratio = count / total;
  if (ratio >= 1) return "#059669";   // emerald-600 – links to ALL
  if (ratio >= 0.75) return "#10b981"; // emerald-500
  if (ratio >= 0.5) return "#001489";  // primary
  return "#9fa8da";                    // primary-200
}

/* ---- Domain search form (isolated to avoid re-rendering parent on keystrokes) ---- */

interface DomainSearchFormProps {
  initialValue: string;
  onSubmit: (query: string) => void;
  onClear: () => void;
  className?: string;
}

function DomainSearchForm({ initialValue, onSubmit, onClear, className }: DomainSearchFormProps) {
  const [inputValue, setInputValue] = useState(initialValue);

  useEffect(() => {
    setInputValue(initialValue);
  }, [initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = inputValue.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    onSubmit(normalized);
  };

  const handleClear = () => {
    setInputValue("");
    onClear();
  };

  return (
    <form className={className} onSubmit={handleSubmit}>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Search domain, e.g. empire"
        className="text-sm border border-gray-300 rounded px-2 py-1 w-56 focus:outline-none focus:ring-1 focus:ring-primary-400"
      />
      <button
        type="submit"
        className="text-xs text-white bg-primary-500 hover:bg-primary-600 px-3 py-1 rounded"
      >
        Search
      </button>
      {initialValue && (
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
        >
          Clear
        </button>
      )}
    </form>
  );
}

/* ---- Main component ---- */

interface IntersectTabProps {
  profile: string;
}

export default function IntersectTab({ profile }: IntersectTabProps) {
  const { profiles } = useProfile();
  const { blocklist } = useBlocklist();
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [minDr, setMinDr] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IntersectResponse | null>(null);
  const [filterCount, setFilterCount] = useState<number | null>(null);
  const [domainSearch, setDomainSearch] = useState<string>("");
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [breakdownData, setBreakdownData] = useState<GapDomainBreakdownRow[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [minDrDisplay, setMinDrDisplay] = useState("");
  const minDrDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const breakdownRef = useRef<HTMLDivElement>(null);
  const gapTableRef = useRef<HTMLDivElement>(null);

  // Session filter persistence
  const getFilters = useCallback(() => ({
    selectedCompetitors: selectedCompetitors.join(","),
    minDr: minDr !== undefined ? String(minDr) : "",
  }), [selectedCompetitors, minDr]);

  const applyFilters = useCallback((f: Record<string, string>) => {
    if (f.selectedCompetitors) setSelectedCompetitors(f.selectedCompetitors.split(",").filter(Boolean));
    if (f.minDr) {
      setMinDr(Number(f.minDr));
      setMinDrDisplay(f.minDr);
    }
  }, []);

  const { loaded: sessionLoaded, save: saveSession } = useSessionFilters(
    "_global", "intersect", getFilters, applyFilters,
  );

  // Clear competitors that match new base
  useEffect(() => {
    setSelectedCompetitors((prev) =>
      prev.filter((c) => c !== profile),
    );
  }, [profile]);

  // Fetch data
  useEffect(() => {
    if (!sessionLoaded) return;
    saveSession();
    if (!profile || selectedCompetitors.length === 0) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetchLinkIntersect(profile, selectedCompetitors, minDr, controller.signal)
      .then((res) => {
        setData(res);
        setFilterCount(null);
        setDomainSearch("");
        setExpandedDomain(null);
        setBreakdownData([]);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [profile, selectedCompetitors, minDr, sessionLoaded, saveSession]);

  const toggleCompetitor = (label: string) => {
    setSelectedCompetitors((prev) =>
      prev.includes(label)
        ? prev.filter((c) => c !== label)
        : [...prev, label],
    );
  };

  // Chart data for intersection summary
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.summary.map((s) => ({
      name:
        s.count === data.competitors.length
          ? `All ${s.count}`
          : `${s.count} of ${data.competitors.length}`,
      domains: s.domains,
      count: s.count,
      total: data.competitors.length,
    }));
  }, [data]);

  // Filtered domains by intersection count + substring search
  const filteredDomains = useMemo(() => {
    if (!data) return [];
    let result = data.domains;
    if (filterCount !== null) {
      result = result.filter((d) => d.competitor_count === filterCount);
    }
    if (domainSearch) {
      const q = domainSearch.toLowerCase();
      result = result.filter((d) => d.referring_domain.toLowerCase().includes(q));
    }
    return result;
  }, [data, filterCount, domainSearch]);

  // Reset breakdown when chart filter changes
  useEffect(() => {
    setExpandedDomain(null);
    setBreakdownData([]);
  }, [filterCount]);

  const handleDomainLookup = useCallback((domain: string) => {
    setExpandedDomain(domain);
    setBreakdownLoading(true);
    fetchGapDomainBreakdown(domain, profile, selectedCompetitors)
      .then((res) => {
        setBreakdownData(res.rows);
        setTimeout(() => breakdownRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      })
      .catch(() => setBreakdownData([]))
      .finally(() => setBreakdownLoading(false));
  }, [profile, selectedCompetitors]);

  const handleDomainSearch = useCallback((query: string) => {
    setDomainSearch(query);
    if (query) {
      setTimeout(() => gapTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }, []);

  const handleGapRowClick = useCallback((row: IntersectDomain) => {
    if (expandedDomain === row.referring_domain) {
      setExpandedDomain(null);
      setBreakdownData([]);
      return;
    }
    handleDomainLookup(row.referring_domain);
  }, [expandedDomain, handleDomainLookup]);

  const breakdownColumns = useMemo((): ColumnDef<GapDomainBreakdownRow, unknown>[] => [
    {
      accessorKey: "referring_url",
      header: "Referring Page",
      size: 320,
      cell: ({ getValue }) => {
        const url = getValue() as string;
        return (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-primary-600 hover:underline break-all"
            title={url}
          >{url}</a>
        );
      },
    },
    {
      accessorKey: "profile_label",
      header: "Links To",
      size: 120,
    },
    {
      accessorKey: "target_url",
      header: "Target",
      size: 280,
      cell: ({ getValue }) => {
        const url = getValue() as string;
        return (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-primary-600 hover:underline truncate block max-w-[260px]"
            title={url}
          >{url}</a>
        );
      },
    },
    {
      accessorKey: "domain_rating",
      header: "DR",
      size: 60,
    },
    {
      accessorKey: "page_traffic",
      header: "Page Traffic",
      size: 100,
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v != null ? v.toLocaleString() : "-";
      },
    },
    {
      accessorKey: "domain_traffic",
      header: "Domain Traffic",
      size: 110,
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v != null ? v.toLocaleString() : "-";
      },
    },
    {
      accessorKey: "anchor",
      header: "Anchor Text",
      size: 200,
    },
    {
      accessorKey: "link_type",
      header: "Link Type",
      size: 80,
    },
    {
      accessorKey: "first_seen",
      header: "First Seen",
      size: 100,
    },
  ], []);

  // Compute N/M intersect info from breakdown data
  const breakdownCompetitorInfo = useMemo(() => {
    if (!breakdownData.length || !data) return null;
    const profiles = new Set(breakdownData.map((r) => r.profile_label));
    return { count: profiles.size, total: data.competitors.length, profiles: Array.from(profiles) };
  }, [breakdownData, data]);

  // Dynamic columns based on competitors
  const columns = useMemo((): ColumnDef<IntersectDomain, unknown>[] => {
    if (!data) return [];
    const cols: ColumnDef<IntersectDomain, unknown>[] = [
      {
        accessorKey: "referring_domain",
        header: "Referring Domain",
        size: 280,
      },
      {
        accessorKey: "max_dr",
        header: "DR",
        size: 60,
      },
      {
        accessorKey: "competitor_count",
        header: "# Competitors",
        size: 110,
        cell: ({ row }) => {
          const count = row.original.competitor_count;
          const total = data.competitors.length;
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                count === total
                  ? "bg-emerald-100 text-emerald-800"
                  : count >= total * 0.5
                    ? "bg-primary-100 text-primary-800"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {count}/{total}
            </span>
          );
        },
      },
    ];

    // Add one boolean column per competitor
    data.competitors.forEach((comp, i) => {
      cols.push({
        id: `comp_${i}`,
        header: comp,
        size: 100,
        accessorFn: (row) => row.competitor_flags[i],
        cell: ({ getValue }) => {
          const val = getValue() as boolean;
          return val ? (
            <span className="text-emerald-600 font-bold">Yes</span>
          ) : (
            <span className="text-gray-300">-</span>
          );
        },
      });
    });

    return cols;
  }, [data]);

  // Total unique gap domains
  const totalGapDomains = data?.domains.length ?? 0;
  const allCompCount = data?.summary.find(
    (s) => s.count === (data?.competitors.length ?? 0),
  )?.domains ?? 0;

  if (profiles.length < 2) {
    return (
      <div className="text-center text-gray-500 py-16">
        <p className="text-lg font-medium">
          At least two profiles are required for intersect analysis.
        </p>
        <p className="text-sm mt-2">
          Ingest backlink data for multiple websites first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-start gap-6 flex-wrap">
        {/* Competitor checkboxes */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="text-xs font-medium text-gray-500">
              Competitors
            </label>
            <button
              className="text-xs text-primary-500 hover:text-primary-700"
              onClick={() => {
                const others = profiles
                  .filter((p) => p.profile_label !== profile)
                  .map((p) => p.profile_label);
                setSelectedCompetitors(
                  selectedCompetitors.length === others.length ? [] : others,
                );
              }}
            >
              {selectedCompetitors.length ===
              profiles.filter((p) => p.profile_label !== profile).length
                ? "Clear"
                : "Select all"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {profiles
              .filter((p) => p.profile_label !== profile)
              .map((p, i) => (
                <label
                  key={p.profile_label}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm cursor-pointer transition-colors ${
                    selectedCompetitors.includes(p.profile_label)
                      ? "border-primary-400 bg-primary-50 text-primary-700"
                      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selectedCompetitors.includes(p.profile_label)}
                    onChange={() => toggleCompetitor(p.profile_label)}
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  {p.profile_label}
                </label>
              ))}
          </div>
        </div>

        {/* Min DR filter */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Min DR
          </label>
          <input
            type="number"
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white w-20"
            placeholder="0"
            value={minDrDisplay}
            onChange={(e) => {
              const val = e.target.value;
              setMinDrDisplay(val);
              clearTimeout(minDrDebounceRef.current);
              minDrDebounceRef.current = setTimeout(() => {
                setMinDr(val ? Number(val) : undefined);
              }, 400);
            }}
            min={0}
            max={100}
          />
        </div>
      </div>

      {loading && (
        <p className="text-sm text-gray-500">Loading intersect data...</p>
      )}

      {!loading && data && data.competitors.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">Total Gap Domains</p>
              <p className="text-2xl font-bold text-gray-900">
                {totalGapDomains.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Link to competitors, not you
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">Link to ALL Competitors</p>
              <p className="text-2xl font-bold text-emerald-600">
                {allCompCount.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Strongest opportunities
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">Competitors Analysed</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.competitors.length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">Showing</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredDomains.length.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {filterCount !== null
                  ? `Linking to ${filterCount} competitor${filterCount > 1 ? "s" : ""}`
                  : "All domains"}
              </p>
            </div>
          </div>

          {/* Intersection chart + legend */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-lg shadow p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Intersection Breakdown
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                How many competitors each gap domain links to. Click a bar to
                filter the table.
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  onClick={(state) => {
                    const label = state?.activeLabel;
                    if (!label) return;
                    const match = chartData.find(
                      (d) => d.name === String(label),
                    );
                    if (match) {
                      setFilterCount(
                        filterCount === match.count ? null : match.count,
                      );
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                    }}
                    formatter={(value) => [
                      Number(value).toLocaleString(),
                      "Domains",
                    ]}
                  />
                  <Bar dataKey="domains" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={intersectColor(entry.count, entry.total)}
                        opacity={
                          filterCount === null || filterCount === entry.count
                            ? 1
                            : 0.3
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Intersection counts list */}
            <div className="bg-white rounded-lg shadow p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Intersection Counts
              </h3>
              <div className="space-y-2">
                {data.summary.map((s) => {
                  const isAll = s.count === data.competitors.length;
                  const isActive = filterCount === s.count;
                  return (
                    <button
                      key={s.count}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive
                          ? "bg-primary-100 text-primary-800 font-medium"
                          : "hover:bg-gray-50 text-gray-700"
                      }`}
                      onClick={() =>
                        setFilterCount(isActive ? null : s.count)
                      }
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-sm"
                          style={{
                            backgroundColor: intersectColor(
                              s.count,
                              data.competitors.length,
                            ),
                          }}
                        />
                        {isAll
                          ? `All ${s.count} competitors`
                          : `${s.count} of ${data.competitors.length} competitors`}
                      </span>
                      <span className="font-mono text-xs">
                        {s.domains.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
                {filterCount !== null && (
                  <button
                    className="w-full text-center text-xs text-primary-500 hover:text-primary-700 mt-2"
                    onClick={() => setFilterCount(null)}
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Domain table */}
          <div ref={gapTableRef} className="bg-white rounded-lg shadow p-5">
            <DataTable
              data={filteredDomains}
              columns={columns}
              pageSize={50}
              onRowClick={handleGapRowClick}
              getRowClassName={(row) => {
                const classes: string[] = [];
                if (blocklist.has(row.referring_domain?.toLowerCase())) classes.push("row-blocklisted");
                if (row.referring_domain === expandedDomain) classes.push("!bg-primary-100");
                return classes.join(" ");
              }}
              statusText={
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">
                    Gap Domains
                    {filterCount !== null && (
                      <span className="text-primary-500 font-normal ml-2">
                        (linking to {filterCount} competitor
                        {filterCount > 1 ? "s" : ""})
                      </span>
                    )}
                    {domainSearch && (
                      <span className="text-primary-500 font-normal ml-2">
                        (matching "{domainSearch}")
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Referring domains linking to competitors but not to{" "}
                    <strong>{profile}</strong>. Click a row to see individual
                    referring pages.
                  </p>
                  <DomainSearchForm
                    initialValue={domainSearch}
                    onSubmit={handleDomainSearch}
                    onClear={() => setDomainSearch("")}
                    className="flex items-center gap-2 mt-2"
                  />
                </div>
              }
              toolbar={
                <ExportButton
                  data={filteredDomains.map((d) => {
                    const row: Record<string, unknown> = {
                      referring_domain: d.referring_domain,
                      max_dr: d.max_dr,
                      competitor_count: d.competitor_count,
                    };
                    data!.competitors.forEach((comp, i) => {
                      row[comp] = d.competitor_flags[i] ? "Yes" : "No";
                    });
                    return row;
                  })}
                  filename="intersect-domains.csv"
                />
              }
            />
          </div>

          {/* Gap Domain Breakdown */}
          <div ref={breakdownRef} className="bg-white rounded-lg shadow p-5">
            {expandedDomain ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">
                      Pages from{" "}
                      <span className="text-primary-600">{expandedDomain}</span>
                      {breakdownCompetitorInfo && (
                        <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          breakdownCompetitorInfo.count === breakdownCompetitorInfo.total
                            ? "bg-emerald-100 text-emerald-800"
                            : breakdownCompetitorInfo.count >= breakdownCompetitorInfo.total * 0.5
                              ? "bg-primary-100 text-primary-800"
                              : "bg-gray-100 text-gray-700"
                        }`}>
                          {breakdownCompetitorInfo.count}/{breakdownCompetitorInfo.total}
                        </span>
                      )}
                    </h3>
                    {breakdownCompetitorInfo && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {data!.competitors.map((comp) => (
                          <span key={comp} className={`text-xs px-1.5 py-0.5 rounded ${
                            breakdownCompetitorInfo.profiles.includes(comp)
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-gray-50 text-gray-400 line-through"
                          }`}>
                            {comp}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Individual referring pages linking to competitors but not to{" "}
                      <strong>{profile}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs text-primary-500 hover:text-primary-700 px-2 py-1 rounded hover:bg-primary-50"
                      onClick={() => gapTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    >
                      Back to Gap Domains
                    </button>
                    <button
                      className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100"
                      onClick={() => {
                        setExpandedDomain(null);
                        setBreakdownData([]);
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
                {breakdownLoading ? (
                  <p className="text-sm text-gray-500 py-4">Loading breakdown...</p>
                ) : (
                  <DataTable
                    data={breakdownData}
                    columns={breakdownColumns}
                    pageSize={25}
                    toolbar={
                      <ExportButton
                        data={breakdownData as unknown as Record<string, unknown>[]}
                        filename={`gap-breakdown-${expandedDomain}.csv`}
                      />
                    }
                  />
                )}
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Pages from domain
                </h3>
                <p className="text-sm text-gray-400 text-center py-4">
                  Select a domain row above to see individual referring pages.
                </p>
              </>
            )}
          </div>
        </>
      )}

      {!loading && data && data.competitors.length === 0 && (
        <p className="text-sm text-amber-600">
          Select at least one competitor to run the intersect analysis.
        </p>
      )}
    </div>
  );
}
