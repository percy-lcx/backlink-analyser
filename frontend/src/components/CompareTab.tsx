import { useState, useEffect, useRef, useCallback } from "react";
import { useProfile } from "./ProfileContext";
import { useBlocklist } from "./BlocklistContext";
import { useSessionFilters } from "../lib/useSessionFilters";
import RadarCompare from "./charts/RadarCompare";
import DrDistribution from "./charts/DrDistribution";
import DataTable from "./tables/DataTable";
import ExportButton from "./tables/ExportButton";
import {
  fetchCompare,
  fetchLinkGap,
  fetchDrDistribution,
  fetchTargetPaths,
  type CompareProfile,
  type LinkGapDomain,
  type DrBucket,
  type TargetPath,
} from "../lib/api";
import type { ColumnDef } from "@tanstack/react-table";
import Tooltip from "./Tooltip";
import { METRICS, getMetricByLabel } from "../lib/metrics";

const gapColumns: ColumnDef<LinkGapDomain, unknown>[] = [
  { accessorKey: "referring_domain", header: "Referring Domain", size: 400, meta: { tooltip: METRICS.referring_domain.short } },
  { accessorKey: "max_dr", header: "DR", meta: { tooltip: METRICS.dr.short } },
  { accessorKey: "total_links", header: "Links", meta: { tooltip: METRICS.links.short } },
  { accessorKey: "total_page_traffic", header: "Page Traffic", meta: { tooltip: METRICS.page_traffic.short } },
];

interface MetricRow {
  metric: string;
  a: number;
  b: number;
  delta: number;
  /** true = higher is better; false = lower is better */
  higherIsBetter: boolean;
  format: (v: number) => string;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const num = (v: number) => v.toLocaleString();
const dec1 = (v: number) => v.toFixed(1);
const dec2 = (v: number) => v.toFixed(2);

function buildMetrics(a: CompareProfile, b: CompareProfile): MetricRow[] {
  const defs: {
    metric: string;
    key: keyof CompareProfile;
    higherIsBetter: boolean;
    format: (v: number) => string;
  }[] = [
    { metric: "Total Links", key: "total_links", higherIsBetter: true, format: num },
    { metric: "Referring Domains", key: "referring_domains", higherIsBetter: true, format: num },
    { metric: "Page Traffic", key: "total_page_traffic", higherIsBetter: true, format: num },
    { metric: "Avg DR", key: "avg_dr", higherIsBetter: true, format: dec1 },
    { metric: "Median DR", key: "median_dr", higherIsBetter: true, format: dec1 },
    { metric: "Dofollow %", key: "dofollow_ratio", higherIsBetter: true, format: pct },
    { metric: "Spam %", key: "spam_ratio", higherIsBetter: false, format: pct },
    { metric: "Anchor Diversity", key: "anchor_diversity", higherIsBetter: true, format: num },
    { metric: "Links / Domain", key: "links_per_domain", higherIsBetter: false, format: dec2 },
    { metric: "Sitewide %", key: "sitewide_ratio", higherIsBetter: false, format: pct },
    { metric: "Image Link %", key: "image_link_ratio", higherIsBetter: false, format: pct },
  ];
  return defs.map((d) => {
    const va = Number(a[d.key]) || 0;
    const vb = Number(b[d.key]) || 0;
    return { metric: d.metric, a: va, b: vb, delta: va - vb, higherIsBetter: d.higherIsBetter, format: d.format };
  });
}

function deltaColor(row: MetricRow): string {
  if (row.delta === 0) return "text-gray-400";
  const aIsBetter = row.higherIsBetter ? row.delta > 0 : row.delta < 0;
  return aIsBetter ? "text-green-600" : "text-red-600";
}

/* ---- Path combobox ---- */

function PathCombobox({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: TargetPath[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = options.filter((o) =>
    o.target_path.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white w-64"
        placeholder={placeholder ?? "/path"}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onChange(search);
            setOpen(false);
          }
        }}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white shadow-lg border border-gray-200 text-sm">
          {filtered.slice(0, 50).map((o) => (
            <li
              key={o.target_path}
              className="px-3 py-1.5 cursor-pointer hover:bg-blue-50 flex justify-between"
              onMouseDown={() => {
                onChange(o.target_path);
                setSearch(o.target_path);
                setOpen(false);
              }}
            >
              <span className="break-all">{o.target_path}</span>
              <span className="text-gray-400 ml-2 shrink-0">{o.link_count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---- Main component ---- */

interface CompareTabProps {
  profile: string;
  onDrBarClick?: (profileLabel: string, drMin: number, drMax: number, targetPath?: string) => void;
  onGapRowClick?: (profileLabel: string, referringDomain: string, targetPath?: string) => void;
}

export default function CompareTab({ profile, onDrBarClick, onGapRowClick }: CompareTabProps) {
  const { profiles } = useProfile();
  const { blocklist } = useBlocklist();
  const [profileB, setProfileB] = useState("");
  const [mode, setMode] = useState<"site" | "url">("site");
  const [pathA, setPathA] = useState("");
  const [pathB, setPathB] = useState("");
  const [pathOptionsA, setPathOptionsA] = useState<TargetPath[]>([]);
  const [pathOptionsB, setPathOptionsB] = useState<TargetPath[]>([]);
  const [loading, setLoading] = useState(false);

  const [compareData, setCompareData] = useState<CompareProfile[]>([]);
  const [gapAtoB, setGapAtoB] = useState<LinkGapDomain[]>([]);
  const [gapBtoA, setGapBtoA] = useState<LinkGapDomain[]>([]);
  const [drDistA, setDrDistA] = useState<DrBucket[]>([]);
  const [drDistB, setDrDistB] = useState<DrBucket[]>([]);

  // Session filter persistence
  const getFilters = useCallback(() => ({
    profileB, mode, pathA, pathB,
  }), [profileB, mode, pathA, pathB]);

  const applyFilters = useCallback((f: Record<string, string>) => {
    if (f.profileB) setProfileB(f.profileB);
    if (f.mode === "site" || f.mode === "url") setMode(f.mode);
    if (f.pathA) setPathA(f.pathA);
    if (f.pathB) setPathB(f.pathB);
  }, []);

  const { loaded: sessionLoaded, save: saveSession } = useSessionFilters(
    "_global", "compare", getFilters, applyFilters,
  );

  // Default profile B to first profile that isn't profile A
  useEffect(() => {
    if (!profileB || profileB === profile) {
      const other = profiles.find((p) => p.profile_label !== profile);
      if (other) setProfileB(other.profile_label);
    }
  }, [profiles, profile, profileB]);

  // Fetch target paths when profiles change
  useEffect(() => {
    if (profile) fetchTargetPaths(profile).then(setPathOptionsA).catch(() => setPathOptionsA([]));
  }, [profile]);

  useEffect(() => {
    if (profileB) fetchTargetPaths(profileB).then(setPathOptionsB).catch(() => setPathOptionsB([]));
  }, [profileB]);

  // Reset paths when switching to site mode
  useEffect(() => {
    if (mode === "site") {
      setPathA("");
      setPathB("");
    }
  }, [mode]);

  // Fetch data when both profiles are selected and different
  useEffect(() => {
    if (!sessionLoaded) return;
    saveSession();
    if (!profile || !profileB || profile === profileB) return;
    if (mode === "url" && (!pathA || !pathB)) return;
    setLoading(true);

    const tpA = mode === "url" ? pathA : undefined;
    const tpB = mode === "url" ? pathB : undefined;

    Promise.all([
      fetchCompare([profile, profileB], tpA && tpB ? [tpA, tpB] : undefined),
      fetchLinkGap(profile, [profileB], tpA, tpB),
      fetchLinkGap(profileB, [profile], tpB, tpA),
      fetchDrDistribution(profile, tpA).then((d) => d.dr ?? []),
      fetchDrDistribution(profileB, tpB).then((d) => d.dr ?? []),
    ])
      .then(([compare, gapA, gapB, drA, drB]) => {
        setCompareData(compare);
        setGapAtoB(gapA);
        setGapBtoA(gapB);
        setDrDistA(drA);
        setDrDistB(drB);
      })
      .catch(() => {
        setCompareData([]);
        setGapAtoB([]);
        setGapBtoA([]);
        setDrDistA([]);
        setDrDistB([]);
      })
      .finally(() => setLoading(false));
  }, [profile, profileB, mode, pathA, pathB, sessionLoaded, saveSession]);

  if (profiles.length < 2) {
    return (
      <div className="text-center text-gray-500 py-16">
        <p className="text-lg font-medium">At least two profiles are required for comparison.</p>
        <p className="text-sm mt-2">Ingest backlink data for multiple websites first.</p>
      </div>
    );
  }

  const dataA = compareData.find((d) => d.profile_label === profile);
  const dataB = compareData.find((d) => d.profile_label === profileB);
  const metrics = dataA && dataB ? buildMetrics(dataA, dataB) : [];

  const labelA = mode === "url" && pathA ? `${profile} ${pathA}` : profile;
  const labelB = mode === "url" && pathB ? `${profileB} ${pathB}` : profileB;

  const drMaxCount = Math.max(
    ...drDistA.map((d) => d.count),
    ...drDistB.map((d) => d.count),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Profile selectors + mode toggle */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Comparing</label>
          <span className="inline-block px-3 py-1.5 text-sm font-medium text-gray-700">{profile}</span>
        </div>
        <span className="text-gray-400 font-medium mt-5">vs</span>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Profile B</label>
          <select
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white"
            value={profileB}
            onChange={(e) => setProfileB(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.profile_label} value={p.profile_label} disabled={p.profile_label === profile}>
                {p.profile_label}
              </option>
            ))}
          </select>
        </div>

        {/* Mode toggle */}
        <div className="ml-auto">
          <label className="block text-xs font-medium text-gray-500 mb-1">Compare by</label>
          <div className="inline-flex rounded-md shadow-sm">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm font-medium rounded-l-md border ${
                mode === "site"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => setMode("site")}
            >
              Site
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm font-medium rounded-r-md border-t border-b border-r ${
                mode === "url"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => setMode("url")}
            >
              URL
            </button>
          </div>
        </div>
      </div>

      {/* URL path selectors */}
      {mode === "url" && (
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{profile} path</label>
            <PathCombobox value={pathA} onChange={setPathA} options={pathOptionsA} placeholder="/slug" />
          </div>
          <span className="text-gray-400 font-medium mt-5">vs</span>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{profileB} path</label>
            <PathCombobox value={pathB} onChange={setPathB} options={pathOptionsB} placeholder="/slug" />
          </div>
          {(!pathA || !pathB) && (
            <p className="text-xs text-amber-600 mt-5">Select a target path for both profiles to compare.</p>
          )}
        </div>
      )}

      {profile === profileB && (
        <p className="text-sm text-amber-600">Select two different profiles to compare.</p>
      )}

      {loading && <p className="text-sm text-gray-500">Loading comparison data...</p>}

      {!loading && metrics.length > 0 && (
        <>
          {/* Radar + Metrics table side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RadarCompare data={compareData} />

            {/* Metrics comparison table */}
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Key Metrics</h3>
                <ExportButton
                  data={metrics.map((row) => ({
                    metric: row.metric,
                    [labelA]: row.format(row.a),
                    [labelB]: row.format(row.b),
                    delta: row.format(row.delta),
                  }))}
                  filename="compare-metrics.csv"
                />
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2 font-medium">Metric</th>
                    <th className="py-2 font-medium">{labelA}</th>
                    <th className="py-2 font-medium">{labelB}</th>
                    <th className="py-2 font-medium">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((row) => (
                    <tr key={row.metric} className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">
                        <Tooltip text={getMetricByLabel(row.metric)?.short ?? ""}>{row.metric}</Tooltip>
                      </td>
                      <td className="py-2">{row.format(row.a)}</td>
                      <td className="py-2">{row.format(row.b)}</td>
                      <td className={`py-2 font-medium ${deltaColor(row)}`}>
                        {row.delta > 0 ? "+" : ""}
                        {row.format(row.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Link gap analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-5">
              <DataTable data={gapAtoB} columns={gapColumns} pageSize={25} onRowClick={onGapRowClick ? (row) => onGapRowClick(profileB, row.referring_domain, mode === "url" ? pathB : undefined) : undefined} getRowClassName={(row: LinkGapDomain) => blocklist.has(row.referring_domain?.toLowerCase()) ? "row-blocklisted" : ""} statusText={<div><h3 className="text-sm font-semibold text-gray-700">Opportunities for {labelA}</h3><p className="text-xs text-gray-400 mt-1">Domains linking to {labelB} but not {labelA}</p></div>} toolbar={<ExportButton data={gapAtoB as unknown as Record<string, unknown>[]} filename="gap-opportunities-a.csv" />} />
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <DataTable data={gapBtoA} columns={gapColumns} pageSize={25} onRowClick={onGapRowClick ? (row) => onGapRowClick(profile, row.referring_domain, mode === "url" ? pathA : undefined) : undefined} getRowClassName={(row: LinkGapDomain) => blocklist.has(row.referring_domain?.toLowerCase()) ? "row-blocklisted" : ""} statusText={<div><h3 className="text-sm font-semibold text-gray-700">Opportunities for {labelB}</h3><p className="text-xs text-gray-400 mt-1">Domains linking to {labelA} but not {labelB}</p></div>} toolbar={<ExportButton data={gapBtoA as unknown as Record<string, unknown>[]} filename="gap-opportunities-b.csv" />} />
            </div>
          </div>

          {/* DR distribution side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{labelA} — DR Distribution</h3>
              <DrDistribution data={drDistA} maxCount={drMaxCount} onBarClick={onDrBarClick ? (bucket) => {
                const [min, max] = bucket.split("-").map(Number);
                onDrBarClick(profile, min, max, mode === "url" ? pathA : undefined);
              } : undefined} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{labelB} — DR Distribution</h3>
              <DrDistribution data={drDistB} maxCount={drMaxCount} onBarClick={onDrBarClick ? (bucket) => {
                const [min, max] = bucket.split("-").map(Number);
                onDrBarClick(profileB, min, max, mode === "url" ? pathB : undefined);
              } : undefined} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
