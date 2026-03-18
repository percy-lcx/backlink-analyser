import { useState, useEffect, useRef, useCallback } from "react";
import { useProfile } from "./ProfileContext";
import { useBlocklist } from "./BlocklistContext";
import { useSessionFilters } from "../lib/useSessionFilters";
import RadarCompare from "./charts/RadarCompare";
import DrDistribution from "./charts/DrDistribution";
import VelocityChart from "./charts/VelocityChart";
import PageCategoryChart from "./charts/PageCategoryChart";
import TopDomainsTable from "./TopDomainsTable";
import TopPagesTable from "./TopPagesTable";
import AlertCard from "./AlertCard";
import DataTable from "./tables/DataTable";
import ExportButton from "./tables/ExportButton";
import {
  fetchCompare,
  fetchLinkGap,
  fetchDrDistribution,
  fetchTargetPaths,
  fetchKeywordProfiles,
  fetchKeywordCompare,
  fetchKeywordCombined,
  fetchOverview,
  fetchVelocity,
  fetchPageBreakdown,
  fetchBrokenLinks,
  fetchSitewide,
  fetchRedirects,
  fetchReferringDomains,
  type CompareProfile,
  type LinkGapDomain,
  type DrBucket,
  type TargetPath,
  type KeywordCompareResponse,
  type KeywordCombinedEntry,
  type SharedKeyword,
  type KeywordOnly,
  type OverviewData,
  type VelocityPoint,
  type PageBreakdownResponse,
  type PageRow,
  type BrokenLinksSummary,
  type RedirectSummary,
  type ReferringDomain,
} from "../lib/api";
import type { ColumnDef } from "@tanstack/react-table";
import Tooltip from "./Tooltip";
import { METRICS, getMetricByLabel } from "../lib/metrics";

type SubTab = "backlinks" | "keywords" | "combined";

const gapColumns: ColumnDef<LinkGapDomain, unknown>[] = [
  { accessorKey: "referring_domain", header: "Referring Domain", size: 400, meta: { tooltip: METRICS.referring_domain.short } },
  { accessorKey: "max_dr", header: "DR", meta: { tooltip: METRICS.dr.short } },
  { accessorKey: "total_links", header: "Links", meta: { tooltip: METRICS.links.short } },
  { accessorKey: "total_page_traffic", header: "Page Traffic", meta: { tooltip: METRICS.page_traffic.short } },
];

const sharedKeywordColumns: ColumnDef<SharedKeyword, unknown>[] = [
  { accessorKey: "keyword", header: "Keyword", size: 300 },
  { accessorKey: "volume", header: "Volume", cell: ({ getValue }) => (getValue() as number).toLocaleString() },
  { accessorKey: "kd", header: "KD" },
  { accessorKey: "position_a", header: "Pos A" },
  { accessorKey: "position_b", header: "Pos B" },
  {
    id: "position_delta",
    header: "Pos Delta",
    accessorFn: (row) => (row.position_b ?? 0) - (row.position_a ?? 0),
    cell: ({ getValue }) => {
      const v = getValue() as number;
      if (v === 0) return <span className="text-gray-400">0</span>;
      return <span className={v > 0 ? "text-green-600" : "text-red-600"}>{v > 0 ? "+" : ""}{v}</span>;
    },
  },
  { accessorKey: "traffic_a", header: "Traffic A", cell: ({ getValue }) => (getValue() as number)?.toLocaleString() ?? "0" },
  { accessorKey: "traffic_b", header: "Traffic B", cell: ({ getValue }) => (getValue() as number)?.toLocaleString() ?? "0" },
];

const onlyKeywordColumns: ColumnDef<KeywordOnly, unknown>[] = [
  { accessorKey: "keyword", header: "Keyword", size: 300 },
  { accessorKey: "volume", header: "Volume", cell: ({ getValue }) => (getValue() as number).toLocaleString() },
  { accessorKey: "kd", header: "KD" },
  { accessorKey: "position", header: "Position" },
  { accessorKey: "traffic", header: "Traffic", cell: ({ getValue }) => (getValue() as number)?.toLocaleString() ?? "0" },
];

interface MetricRow {
  metric: string;
  a: number;
  b: number;
  delta: number;
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

/* ---- Summary stat card ---- */

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-800">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

/* ---- Intent distribution bar ---- */

function IntentBar({ label, data, color }: { label: string; data: Record<string, number>; color: string }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0) || 1;
  const intents = ["informational", "commercial", "transactional", "navigational"];
  const colors: Record<string, string> = {
    informational: "bg-blue-400",
    commercial: "bg-amber-400",
    transactional: "bg-green-400",
    navigational: "bg-purple-400",
  };

  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
      <div className={`flex h-5 rounded overflow-hidden ${color}`}>
        {intents.map((intent) => {
          const pctVal = ((data[intent] ?? 0) / total) * 100;
          if (pctVal === 0) return null;
          return (
            <div
              key={intent}
              className={`${colors[intent]} relative group`}
              style={{ width: `${pctVal}%` }}
              title={`${intent}: ${data[intent] ?? 0} (${pctVal.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="flex gap-3 mt-1">
        {intents.map((intent) => (
          <span key={intent} className="text-[10px] text-gray-500">
            <span className={`inline-block w-2 h-2 rounded-full ${colors[intent]} mr-0.5`} />
            {intent}: {data[intent] ?? 0}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---- Main component ---- */

interface CompareTabProps {
  profile: string;
  onDrBarClick?: (profileLabel: string, drMin: number, drMax: number, targetPath?: string) => void;
  onGapRowClick?: (profileLabel: string, referringDomain: string, targetPath?: string) => void;
  onPageCategoryClick?: (profileLabel: string, category: string) => void;
  onViewAllPages?: (profileLabel: string) => void;
  onViewAllDomains?: (profileLabel: string) => void;
}

export default function CompareTab({ profile, onDrBarClick, onGapRowClick, onPageCategoryClick, onViewAllPages, onViewAllDomains }: CompareTabProps) {
  const { profiles } = useProfile();
  const { blocklist } = useBlocklist();
  const [profileB, setProfileB] = useState("");
  const [mode, setMode] = useState<"site" | "url">("site");
  const [pathA, setPathA] = useState("");
  const [pathB, setPathB] = useState("");
  const [pathOptionsA, setPathOptionsA] = useState<TargetPath[]>([]);
  const [pathOptionsB, setPathOptionsB] = useState<TargetPath[]>([]);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>("backlinks");

  // Backlinks state
  const [compareData, setCompareData] = useState<CompareProfile[]>([]);
  const [gapAtoB, setGapAtoB] = useState<LinkGapDomain[]>([]);
  const [gapBtoA, setGapBtoA] = useState<LinkGapDomain[]>([]);
  const [drDistA, setDrDistA] = useState<DrBucket[]>([]);
  const [drDistB, setDrDistB] = useState<DrBucket[]>([]);

  // Overview visualizations state
  const [overviewA, setOverviewA] = useState<OverviewData | null>(null);
  const [overviewB, setOverviewB] = useState<OverviewData | null>(null);
  const [velocityA, setVelocityA] = useState<VelocityPoint[]>([]);
  const [velocityB, setVelocityB] = useState<VelocityPoint[]>([]);
  const [pageCatsA, setPageCatsA] = useState<PageBreakdownResponse["categories"]>({});
  const [pageCatsB, setPageCatsB] = useState<PageBreakdownResponse["categories"]>({});
  const [topPagesA, setTopPagesA] = useState<PageRow[]>([]);
  const [topPagesB, setTopPagesB] = useState<PageRow[]>([]);
  const [topDomainsA, setTopDomainsA] = useState<ReferringDomain[]>([]);
  const [topDomainsB, setTopDomainsB] = useState<ReferringDomain[]>([]);
  const [brokenA, setBrokenA] = useState<BrokenLinksSummary | null>(null);
  const [brokenB, setBrokenB] = useState<BrokenLinksSummary | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sitewideA, setSitewideA] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sitewideB, setSitewideB] = useState<any>(null);
  const [redirectsA, setRedirectsA] = useState<RedirectSummary | null>(null);
  const [redirectsB, setRedirectsB] = useState<RedirectSummary | null>(null);

  // Keywords state
  const [hasKeywords, setHasKeywords] = useState(false);
  const [kwLoading, setKwLoading] = useState(false);
  const [kwData, setKwData] = useState<KeywordCompareResponse | null>(null);

  // Combined state
  const [combinedLoading, setCombinedLoading] = useState(false);
  const [combinedData, setCombinedData] = useState<KeywordCombinedEntry[]>([]);

  // Check keyword data availability on mount
  useEffect(() => {
    fetchKeywordProfiles().then((kps) => setHasKeywords(kps.length > 0)).catch(() => setHasKeywords(false));
  }, []);

  // Session filter persistence
  const getFilters = useCallback(() => ({
    profileB, mode, pathA, pathB, subTab,
  }), [profileB, mode, pathA, pathB, subTab]);

  const applyFilters = useCallback((f: Record<string, string>) => {
    if (f.profileB) setProfileB(f.profileB);
    if (f.mode === "site" || f.mode === "url") setMode(f.mode);
    if (f.pathA) setPathA(f.pathA);
    if (f.pathB) setPathB(f.pathB);
    if (f.subTab === "backlinks" || f.subTab === "keywords" || f.subTab === "combined") setSubTab(f.subTab);
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

  // Fetch backlinks data
  useEffect(() => {
    if (!sessionLoaded) return;
    saveSession();
    if (!profile || !profileB || profile === profileB) return;
    if (mode === "url" && (!pathA || !pathB)) return;
    if (subTab !== "backlinks") return;
    setLoading(true);

    const tpA = mode === "url" ? pathA : undefined;
    const tpB = mode === "url" ? pathB : undefined;

    Promise.all([
      fetchCompare([profile, profileB], tpA && tpB ? [tpA, tpB] : undefined),
      fetchLinkGap(profile, [profileB], tpA, tpB),
      fetchLinkGap(profileB, [profile], tpB, tpA),
      fetchDrDistribution(profile, tpA).then((d) => d.dr ?? []),
      fetchDrDistribution(profileB, tpB).then((d) => d.dr ?? []),
      fetchOverview(profile, tpA).catch(() => null),
      fetchOverview(profileB, tpB).catch(() => null),
      fetchVelocity(profile, undefined, tpA).catch(() => []),
      fetchVelocity(profileB, undefined, tpB).catch(() => []),
      fetchPageBreakdown(profile).catch(() => ({ pages: [], categories: {} } as PageBreakdownResponse)),
      fetchPageBreakdown(profileB).catch(() => ({ pages: [], categories: {} } as PageBreakdownResponse)),
      fetchReferringDomains(profile, { sort: "max_dr:desc", target_path: tpA }).catch(() => []),
      fetchReferringDomains(profileB, { sort: "max_dr:desc", target_path: tpB }).catch(() => []),
      fetchBrokenLinks(profile, { per_page: 1, target_path: tpA }).then((r) => r.summary).catch(() => null),
      fetchBrokenLinks(profileB, { per_page: 1, target_path: tpB }).then((r) => r.summary).catch(() => null),
      fetchSitewide(profile, undefined, tpA).catch(() => null),
      fetchSitewide(profileB, undefined, tpB).catch(() => null),
      fetchRedirects(profile, tpA).catch(() => null),
      fetchRedirects(profileB, tpB).catch(() => null),
    ])
      .then(([compare, gapA, gapB, drA, drB, ovA, ovB, velA, velB, pgA, pgB, domsA, domsB, brkA, brkB, swA, swB, redirA, redirB]) => {
        setCompareData(compare);
        setGapAtoB(gapA);
        setGapBtoA(gapB);
        setDrDistA(drA);
        setDrDistB(drB);
        setOverviewA(ovA as OverviewData | null);
        setOverviewB(ovB as OverviewData | null);
        setVelocityA(velA as VelocityPoint[]);
        setVelocityB(velB as VelocityPoint[]);
        const pdA = pgA as PageBreakdownResponse;
        const pdB = pgB as PageBreakdownResponse;
        setPageCatsA(pdA.categories ?? {});
        setPageCatsB(pdB.categories ?? {});
        setTopPagesA(pdA.pages ?? []);
        setTopPagesB(pdB.pages ?? []);
        setTopDomainsA(domsA as ReferringDomain[]);
        setTopDomainsB(domsB as ReferringDomain[]);
        setBrokenA(brkA as BrokenLinksSummary | null);
        setBrokenB(brkB as BrokenLinksSummary | null);
        setSitewideA(swA);
        setSitewideB(swB);
        setRedirectsA(redirA as RedirectSummary | null);
        setRedirectsB(redirB as RedirectSummary | null);
      })
      .catch(() => {
        setCompareData([]);
        setGapAtoB([]);
        setGapBtoA([]);
        setDrDistA([]);
        setDrDistB([]);
      })
      .finally(() => setLoading(false));
  }, [profile, profileB, mode, pathA, pathB, sessionLoaded, saveSession, subTab]);

  // Fetch keywords data
  useEffect(() => {
    if (!sessionLoaded) return;
    if (!profile || !profileB || profile === profileB) return;
    if (mode === "url" && (!pathA || !pathB)) return;
    if (subTab !== "keywords" || !hasKeywords) return;
    setKwLoading(true);

    const tpA = mode === "url" ? pathA : undefined;
    const tpB = mode === "url" ? pathB : undefined;

    fetchKeywordCompare(profile, profileB, tpA, tpB)
      .then(setKwData)
      .catch(() => setKwData(null))
      .finally(() => setKwLoading(false));
  }, [profile, profileB, mode, pathA, pathB, sessionLoaded, subTab, hasKeywords]);

  // Fetch combined data
  useEffect(() => {
    if (!sessionLoaded) return;
    if (!profile || !profileB || profile === profileB) return;
    if (subTab !== "combined") return;
    setCombinedLoading(true);

    fetchKeywordCombined(profile, profileB)
      .then(setCombinedData)
      .catch(() => setCombinedData([]))
      .finally(() => setCombinedLoading(false));
  }, [profile, profileB, sessionLoaded, subTab]);

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

  const subTabs: { key: SubTab; label: string; disabled?: boolean }[] = [
    { key: "backlinks", label: "Backlinks" },
    { key: "keywords", label: "Keywords", disabled: !hasKeywords },
    { key: "combined", label: "Combined Insights", disabled: !hasKeywords },
  ];

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

      {/* Sub-tab toggle */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          {subTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              disabled={t.disabled}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                subTab === t.key
                  ? "border-blue-600 text-blue-600"
                  : t.disabled
                    ? "border-transparent text-gray-300 cursor-not-allowed"
                    : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => !t.disabled && setSubTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {profile === profileB && (
        <p className="text-sm text-amber-600">Select two different profiles to compare.</p>
      )}

      {/* Backlinks sub-tab */}
      {subTab === "backlinks" && (
        <>
          {loading && <p className="text-sm text-gray-500">Loading comparison data...</p>}

          {!loading && metrics.length > 0 && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RadarCompare data={compareData} />
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-5">
                  <DataTable data={gapAtoB} columns={gapColumns} pageSize={25} onRowClick={onGapRowClick ? (row) => onGapRowClick(profileB, row.referring_domain, mode === "url" ? pathB : undefined) : undefined} getRowClassName={(row: LinkGapDomain) => blocklist.has(row.referring_domain?.toLowerCase()) ? "row-blocklisted" : ""} statusText={<div><h3 className="text-sm font-semibold text-gray-700">Opportunities for {labelA}</h3><p className="text-xs text-gray-400 mt-1">Domains linking to {labelB} but not {labelA}</p></div>} toolbar={<ExportButton data={gapAtoB as unknown as Record<string, unknown>[]} filename="gap-opportunities-a.csv" />} />
                </div>
                <div className="bg-white rounded-lg shadow p-5">
                  <DataTable data={gapBtoA} columns={gapColumns} pageSize={25} onRowClick={onGapRowClick ? (row) => onGapRowClick(profile, row.referring_domain, mode === "url" ? pathA : undefined) : undefined} getRowClassName={(row: LinkGapDomain) => blocklist.has(row.referring_domain?.toLowerCase()) ? "row-blocklisted" : ""} statusText={<div><h3 className="text-sm font-semibold text-gray-700">Opportunities for {labelB}</h3><p className="text-xs text-gray-400 mt-1">Domains linking to {labelA} but not {labelB}</p></div>} toolbar={<ExportButton data={gapBtoA as unknown as Record<string, unknown>[]} filename="gap-opportunities-b.csv" />} />
                </div>
              </div>

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

              {/* Link Health Alerts */}
              {(overviewA || overviewB) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Link Health</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[
                      { label: labelA, overview: overviewA, broken: brokenA, sitewide: sitewideA, redirects: redirectsA },
                      { label: labelB, overview: overviewB, broken: brokenB, sitewide: sitewideB, redirects: redirectsB },
                    ].map(({ label, overview, broken, sitewide: sw, redirects: redir }) => (
                      <div key={label}>
                        <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <AlertCard
                            label="Broken Links"
                            value={broken ? broken.total_broken.toLocaleString() : "—"}
                            subtitle={broken ? `4xx: ${broken.count_4xx} / 5xx: ${broken.count_5xx}` : undefined}
                            status={!broken || broken.total_broken === 0 ? "ok" : broken.total_broken <= 10 ? "warning" : "danger"}
                            tooltip={METRICS.broken_links_alert.short}
                          />
                          <AlertCard
                            label="Sitewide Links"
                            value={(() => {
                              const s = sw?.aggregate?.sitewide ?? sw?.with_sitewide;
                              return s ? (s.link_count ?? s.total_links ?? 0).toLocaleString() : "0";
                            })()}
                            subtitle={(() => {
                              const s = sw?.aggregate?.sitewide ?? sw?.with_sitewide;
                              return s ? `${s.unique_domains ?? 0} domains` : undefined;
                            })()}
                            status={(() => {
                              const s = sw?.aggregate?.sitewide ?? sw?.with_sitewide;
                              if (!s || !overview?.total_backlinks) return "ok";
                              const links = s.link_count ?? s.total_links ?? 0;
                              const ratio = links / overview.total_backlinks;
                              return ratio > 0.5 ? "danger" : ratio > 0.3 ? "warning" : "ok";
                            })()}
                            tooltip={METRICS.sitewide_alert.short}
                          />
                          <AlertCard
                            label="Redirect Issues"
                            value={redir ? redir.total_with_redirects.toLocaleString() : "—"}
                            subtitle={redir && overview?.total_backlinks ? `${((redir.total_with_redirects / overview.total_backlinks) * 100).toFixed(1)}% of links` : undefined}
                            status={(() => {
                              if (!redir || redir.total_with_redirects === 0) return "ok";
                              const p = overview?.total_backlinks ? (redir.total_with_redirects / overview.total_backlinks) * 100 : 0;
                              return p > 10 ? "danger" : "warning";
                            })()}
                            tooltip={METRICS.redirect_alert.short}
                          />
                          <AlertCard
                            label="Spam Count"
                            value={Math.round((overview?.spam_ratio ?? 0) * (overview?.total_backlinks ?? 0)).toLocaleString()}
                            subtitle={`${((overview?.spam_ratio ?? 0) * 100).toFixed(1)}% of total`}
                            status={(overview?.spam_ratio ?? 0) > 0.1 ? "danger" : (overview?.spam_ratio ?? 0) > 0.05 ? "warning" : "ok"}
                            tooltip={METRICS.spam_ratio.short}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Page Category Charts */}
              {mode === "url" ? (
                <div className="bg-gray-50 rounded-lg p-6 text-center text-sm text-gray-500">
                  <p className="font-medium">Backlinks by category</p>
                  <p>Only available for site-level comparison</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">{labelA}</h3>
                    <PageCategoryChart
                      data={Object.entries(pageCatsA).map(([category, stats]) => ({ category, link_count: stats.link_count }))}
                      onBarClick={onPageCategoryClick ? (cat) => onPageCategoryClick(profile, cat) : undefined}
                      onViewAll={onViewAllPages ? () => onViewAllPages(profile) : undefined}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">{labelB}</h3>
                    <PageCategoryChart
                      data={Object.entries(pageCatsB).map(([category, stats]) => ({ category, link_count: stats.link_count }))}
                      onBarClick={onPageCategoryClick ? (cat) => onPageCategoryClick(profileB, cat) : undefined}
                      onViewAll={onViewAllPages ? () => onViewAllPages(profileB) : undefined}
                    />
                  </div>
                </div>
              )}

              {/* Velocity Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">{labelA}</h3>
                  <VelocityChart data={velocityA} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">{labelB}</h3>
                  <VelocityChart data={velocityB} />
                </div>
              </div>

              {/* Top Domains & Top Pages */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">{labelA}</h3>
                  <TopDomainsTable domains={topDomainsA} onViewAll={onViewAllDomains ? () => onViewAllDomains(profile) : undefined} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">{labelB}</h3>
                  <TopDomainsTable domains={topDomainsB} onViewAll={onViewAllDomains ? () => onViewAllDomains(profileB) : undefined} />
                </div>
              </div>

              {mode === "url" ? (
                <div className="bg-gray-50 rounded-lg p-6 text-center text-sm text-gray-500">
                  <p className="font-medium">Top pages</p>
                  <p>Only available for site-level comparison</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">{labelA}</h3>
                    <TopPagesTable pages={topPagesA} onViewAll={onViewAllPages ? () => onViewAllPages(profile) : undefined} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">{labelB}</h3>
                    <TopPagesTable pages={topPagesB} onViewAll={onViewAllPages ? () => onViewAllPages(profileB) : undefined} />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Keywords sub-tab */}
      {subTab === "keywords" && (
        <>
          {!hasKeywords && (
            <div className="text-center text-gray-500 py-16">
              <p className="text-lg font-medium">No keyword data available</p>
              <p className="text-sm mt-2">Place organic keywords CSV files in <code>data/keywords/</code> and run ingestion.</p>
            </div>
          )}

          {hasKeywords && kwLoading && <p className="text-sm text-gray-500">Loading keyword comparison...</p>}

          {hasKeywords && !kwLoading && kwData && (
            <>
              {/* Keyword summary cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">{labelA}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Total Keywords" value={kwData.summary_a.total_keywords} />
                    <StatCard label="Total Traffic" value={kwData.summary_a.total_traffic} />
                    <StatCard label="Avg Position" value={dec1(kwData.summary_a.avg_position ?? 0)} />
                    <StatCard label="Avg KD" value={dec1(kwData.summary_a.avg_kd ?? 0)} />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">{labelB}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Total Keywords" value={kwData.summary_b.total_keywords} />
                    <StatCard label="Total Traffic" value={kwData.summary_b.total_traffic} />
                    <StatCard label="Avg Position" value={dec1(kwData.summary_b.avg_position ?? 0)} />
                    <StatCard label="Avg KD" value={dec1(kwData.summary_b.avg_kd ?? 0)} />
                  </div>
                </div>
              </div>

              {/* Overlap summary */}
              <div className="bg-white rounded-lg shadow p-5">
                <div className="flex gap-6 text-sm">
                  <span className="text-gray-600">Shared: <strong>{kwData.shared_keywords.length.toLocaleString()}</strong></span>
                  <span className="text-blue-600">Only {labelA}: <strong>{kwData.only_a.length.toLocaleString()}</strong></span>
                  <span className="text-orange-600">Only {labelB}: <strong>{kwData.only_b.length.toLocaleString()}</strong></span>
                </div>
              </div>

              {/* Shared keywords table */}
              {kwData.shared_keywords.length > 0 && (
                <div className="bg-white rounded-lg shadow p-5">
                  <DataTable
                    data={kwData.shared_keywords}
                    columns={sharedKeywordColumns}
                    pageSize={25}
                    statusText={<h3 className="text-sm font-semibold text-gray-700">Shared Keywords ({kwData.shared_keywords.length.toLocaleString()})</h3>}
                    toolbar={<ExportButton data={kwData.shared_keywords as unknown as Record<string, unknown>[]} filename="shared-keywords.csv" />}
                  />
                </div>
              )}

              {/* Only-A and Only-B keyword tables side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {kwData.only_a.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-5">
                    <DataTable
                      data={kwData.only_a}
                      columns={onlyKeywordColumns}
                      pageSize={25}
                      statusText={<h3 className="text-sm font-semibold text-gray-700">Only in {labelA} ({kwData.only_a.length.toLocaleString()})</h3>}
                      toolbar={<ExportButton data={kwData.only_a as unknown as Record<string, unknown>[]} filename="keywords-only-a.csv" />}
                    />
                  </div>
                )}
                {kwData.only_b.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-5">
                    <DataTable
                      data={kwData.only_b}
                      columns={onlyKeywordColumns}
                      pageSize={25}
                      statusText={<h3 className="text-sm font-semibold text-gray-700">Only in {labelB} ({kwData.only_b.length.toLocaleString()})</h3>}
                      toolbar={<ExportButton data={kwData.only_b as unknown as Record<string, unknown>[]} filename="keywords-only-b.csv" />}
                    />
                  </div>
                )}
              </div>

              {/* Intent distribution */}
              {(Object.keys(kwData.intent_distribution_a).length > 0 || Object.keys(kwData.intent_distribution_b).length > 0) && (
                <div className="bg-white rounded-lg shadow p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700">Search Intent Distribution</h3>
                  <IntentBar label={labelA} data={kwData.intent_distribution_a} color="bg-gray-100" />
                  <IntentBar label={labelB} data={kwData.intent_distribution_b} color="bg-gray-100" />
                </div>
              )}

              {/* SERP features comparison */}
              {(Object.keys(kwData.serp_features_a).length > 0 || Object.keys(kwData.serp_features_b).length > 0) && (
                <div className="bg-white rounded-lg shadow p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">SERP Feature Comparison</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="py-2 font-medium">Feature</th>
                        <th className="py-2 font-medium">{labelA}</th>
                        <th className="py-2 font-medium">{labelB}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(new Set([...Object.keys(kwData.serp_features_a), ...Object.keys(kwData.serp_features_b)]))
                        .sort((a, b) => ((kwData.serp_features_a[b] ?? 0) + (kwData.serp_features_b[b] ?? 0)) - ((kwData.serp_features_a[a] ?? 0) + (kwData.serp_features_b[a] ?? 0)))
                        .map((feature) => (
                          <tr key={feature} className="border-b border-gray-100">
                            <td className="py-2 text-gray-700">{feature}</td>
                            <td className="py-2">{(kwData.serp_features_a[feature] ?? 0).toLocaleString()}</td>
                            <td className="py-2">{(kwData.serp_features_b[feature] ?? 0).toLocaleString()}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Combined Insights sub-tab */}
      {subTab === "combined" && (
        <>
          {combinedLoading && <p className="text-sm text-gray-500">Loading combined insights...</p>}

          {!combinedLoading && combinedData.length === 2 && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {combinedData.map((entry) => (
                  <div key={entry.profile_label} className="bg-white rounded-lg shadow p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">{entry.profile_label}</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard label="Ref. Domains" value={entry.ref_domains} />
                      <StatCard label="Avg DR" value={dec1(entry.avg_dr ?? 0)} />
                      <StatCard label="Total Links" value={entry.total_links} />
                      <StatCard label="Keywords" value={entry.total_keywords} />
                      <StatCard label="Organic Traffic" value={entry.total_traffic} />
                      <StatCard label="Avg Position" value={dec1(entry.avg_position ?? 0)} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Backlink vs Keyword comparison table */}
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Backlink Strength vs Keyword Performance</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-2 font-medium">Metric</th>
                      <th className="py-2 font-medium">{profile}</th>
                      <th className="py-2 font-medium">{profileB}</th>
                      <th className="py-2 font-medium">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Referring Domains", key: "ref_domains" as const, higher: true },
                      { label: "Avg DR", key: "avg_dr" as const, higher: true },
                      { label: "Total Links", key: "total_links" as const, higher: true },
                      { label: "Total Keywords", key: "total_keywords" as const, higher: true },
                      { label: "Organic Traffic", key: "total_traffic" as const, higher: true },
                      { label: "Avg Position", key: "avg_position" as const, higher: false },
                    ].map(({ label, key, higher }) => {
                      const va = Number(combinedData[0]?.[key]) || 0;
                      const vb = Number(combinedData[1]?.[key]) || 0;
                      const delta = va - vb;
                      const fmt = key === "avg_dr" || key === "avg_position" ? dec1 : num;
                      const color = delta === 0 ? "text-gray-400" : (higher ? delta > 0 : delta < 0) ? "text-green-600" : "text-red-600";
                      return (
                        <tr key={key} className="border-b border-gray-100">
                          <td className="py-2 text-gray-700">{label}</td>
                          <td className="py-2">{fmt(va)}</td>
                          <td className="py-2">{fmt(vb)}</td>
                          <td className={`py-2 font-medium ${color}`}>{delta > 0 ? "+" : ""}{fmt(delta)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!combinedLoading && combinedData.length < 2 && (
            <p className="text-sm text-gray-500">No combined data available. Ensure both profiles have backlink and keyword data.</p>
          )}
        </>
      )}
    </div>
  );
}
