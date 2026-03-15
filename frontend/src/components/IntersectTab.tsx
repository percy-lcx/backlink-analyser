import { useState, useEffect, useMemo } from "react";
import { useProfile } from "./ProfileContext";
import DataTable from "./tables/DataTable";
import ExportButton from "./tables/ExportButton";
import {
  fetchLinkIntersect,
  type IntersectDomain,
  type IntersectResponse,
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
  "#6366f1", // indigo
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
  if (ratio >= 0.5) return "#6366f1";  // indigo
  return "#a5b4fc";                    // indigo-300
}

/* ---- Main component ---- */

interface IntersectTabProps {
  onGapRowClick?: (profileLabel: string, referringDomain: string) => void;
}

export default function IntersectTab({ onGapRowClick }: IntersectTabProps) {
  const { profiles } = useProfile();
  const [baseProfile, setBaseProfile] = useState("");
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [minDr, setMinDr] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IntersectResponse | null>(null);
  const [filterCount, setFilterCount] = useState<number | null>(null);

  // Default base to first profile
  useEffect(() => {
    if (profiles.length > 0 && !baseProfile) {
      setBaseProfile(profiles[0].profile_label);
    }
  }, [profiles, baseProfile]);

  // Clear competitors that match new base
  useEffect(() => {
    setSelectedCompetitors((prev) =>
      prev.filter((c) => c !== baseProfile),
    );
  }, [baseProfile]);

  // Fetch data
  useEffect(() => {
    if (!baseProfile || selectedCompetitors.length === 0) {
      setData(null);
      return;
    }
    setLoading(true);
    fetchLinkIntersect(baseProfile, selectedCompetitors, minDr)
      .then((res) => {
        setData(res);
        setFilterCount(null);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [baseProfile, selectedCompetitors, minDr]);

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

  // Filtered domains by intersection count
  const filteredDomains = useMemo(() => {
    if (!data) return [];
    if (filterCount === null) return data.domains;
    return data.domains.filter((d) => d.competitor_count === filterCount);
  }, [data, filterCount]);

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
                    ? "bg-indigo-100 text-indigo-800"
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
        {/* Base profile */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Your Site
          </label>
          <select
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white"
            value={baseProfile}
            onChange={(e) => setBaseProfile(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.profile_label} value={p.profile_label}>
                {p.profile_label}
              </option>
            ))}
          </select>
        </div>

        {/* Competitor checkboxes */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="text-xs font-medium text-gray-500">
              Competitors
            </label>
            <button
              className="text-xs text-indigo-600 hover:text-indigo-800"
              onClick={() => {
                const others = profiles
                  .filter((p) => p.profile_label !== baseProfile)
                  .map((p) => p.profile_label);
                setSelectedCompetitors(
                  selectedCompetitors.length === others.length ? [] : others,
                );
              }}
            >
              {selectedCompetitors.length ===
              profiles.filter((p) => p.profile_label !== baseProfile).length
                ? "Clear"
                : "Select all"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {profiles
              .filter((p) => p.profile_label !== baseProfile)
              .map((p, i) => (
                <label
                  key={p.profile_label}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm cursor-pointer transition-colors ${
                    selectedCompetitors.includes(p.profile_label)
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700"
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
            value={minDr ?? ""}
            onChange={(e) =>
              setMinDr(e.target.value ? Number(e.target.value) : undefined)
            }
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
                          ? "bg-indigo-100 text-indigo-800 font-medium"
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
                    className="w-full text-center text-xs text-indigo-600 hover:text-indigo-800 mt-2"
                    onClick={() => setFilterCount(null)}
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Domain table */}
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-700">
                Gap Domains
                {filterCount !== null && (
                  <span className="text-indigo-600 font-normal ml-2">
                    (linking to {filterCount} competitor
                    {filterCount > 1 ? "s" : ""})
                  </span>
                )}
              </h3>
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
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Referring domains linking to competitors but not to{" "}
              <strong>{baseProfile}</strong>. Sorted by intersection count, then
              DR.
            </p>
            <DataTable
              data={filteredDomains}
              columns={columns}
              pageSize={50}
              onRowClick={
                onGapRowClick
                  ? (row) =>
                      onGapRowClick(baseProfile, row.referring_domain)
                  : undefined
              }
            />
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
