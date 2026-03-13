import { useState, useEffect } from "react";
import { useProfile } from "./ProfileContext";
import RadarCompare from "./charts/RadarCompare";
import DrDistribution from "./charts/DrDistribution";
import DataTable from "./tables/DataTable";
import {
  fetchCompare,
  fetchLinkGap,
  fetchDrDistribution,
  type CompareProfile,
  type LinkGapDomain,
  type DrBucket,
} from "../lib/api";
import type { ColumnDef } from "@tanstack/react-table";

const gapColumns: ColumnDef<LinkGapDomain, unknown>[] = [
  { accessorKey: "referring_domain", header: "Referring Domain" },
  { accessorKey: "max_dr", header: "DR" },
  { accessorKey: "total_links", header: "Links" },
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

function buildMetrics(a: CompareProfile, b: CompareProfile): MetricRow[] {
  const defs: {
    metric: string;
    key: keyof CompareProfile;
    higherIsBetter: boolean;
    format: (v: number) => string;
  }[] = [
    { metric: "Total Links", key: "total_links", higherIsBetter: true, format: num },
    { metric: "Referring Domains", key: "referring_domains", higherIsBetter: true, format: num },
    { metric: "Avg DR", key: "avg_dr", higherIsBetter: true, format: dec1 },
    { metric: "Dofollow %", key: "dofollow_ratio", higherIsBetter: true, format: pct },
    { metric: "Spam %", key: "spam_ratio", higherIsBetter: false, format: pct },
    { metric: "Anchor Diversity", key: "anchor_diversity", higherIsBetter: true, format: num },
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

export default function CompareTab() {
  const { profiles } = useProfile();
  const [profileA, setProfileA] = useState("");
  const [profileB, setProfileB] = useState("");
  const [loading, setLoading] = useState(false);

  const [compareData, setCompareData] = useState<CompareProfile[]>([]);
  const [gapAtoB, setGapAtoB] = useState<LinkGapDomain[]>([]);
  const [gapBtoA, setGapBtoA] = useState<LinkGapDomain[]>([]);
  const [drDistA, setDrDistA] = useState<DrBucket[]>([]);
  const [drDistB, setDrDistB] = useState<DrBucket[]>([]);

  // Default to first two profiles
  useEffect(() => {
    if (profiles.length >= 2) {
      if (!profileA) setProfileA(profiles[0].profile_label);
      if (!profileB) setProfileB(profiles[1].profile_label);
    } else if (profiles.length === 1 && !profileA) {
      setProfileA(profiles[0].profile_label);
    }
  }, [profiles, profileA, profileB]);

  // Fetch data when both profiles are selected and different
  useEffect(() => {
    if (!profileA || !profileB || profileA === profileB) return;
    setLoading(true);

    Promise.all([
      fetchCompare([profileA, profileB]),
      fetchLinkGap(profileA, [profileB]),
      fetchLinkGap(profileB, [profileA]),
      fetchDrDistribution(profileA).then((d) => d.dr ?? []),
      fetchDrDistribution(profileB).then((d) => d.dr ?? []),
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
  }, [profileA, profileB]);

  if (profiles.length < 2) {
    return (
      <div className="text-center text-gray-500 py-16">
        <p className="text-lg font-medium">At least two profiles are required for comparison.</p>
        <p className="text-sm mt-2">Ingest backlink data for multiple websites first.</p>
      </div>
    );
  }

  const dataA = compareData.find((d) => d.profile_label === profileA);
  const dataB = compareData.find((d) => d.profile_label === profileB);
  const metrics = dataA && dataB ? buildMetrics(dataA, dataB) : [];

  return (
    <div className="space-y-6">
      {/* Profile selectors */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Profile A</label>
          <select
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white"
            value={profileA}
            onChange={(e) => setProfileA(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.profile_label} value={p.profile_label} disabled={p.profile_label === profileB}>
                {p.profile_label}
              </option>
            ))}
          </select>
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
              <option key={p.profile_label} value={p.profile_label} disabled={p.profile_label === profileA}>
                {p.profile_label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {profileA === profileB && (
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
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Key Metrics</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2 font-medium">Metric</th>
                    <th className="py-2 font-medium">{profileA}</th>
                    <th className="py-2 font-medium">{profileB}</th>
                    <th className="py-2 font-medium">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((row) => (
                    <tr key={row.metric} className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">{row.metric}</td>
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
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Opportunities for {profileA}
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                Domains linking to {profileB} but not {profileA}
              </p>
              <DataTable data={gapAtoB} columns={gapColumns} pageSize={25} />
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Opportunities for {profileB}
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                Domains linking to {profileA} but not {profileB}
              </p>
              <DataTable data={gapBtoA} columns={gapColumns} pageSize={25} />
            </div>
          </div>

          {/* DR distribution side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{profileA} — DR Distribution</h3>
              <DrDistribution data={drDistA} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{profileB} — DR Distribution</h3>
              <DrDistribution data={drDistB} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
