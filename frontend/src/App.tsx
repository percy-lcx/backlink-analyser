import { useState, useEffect } from "react";
import { ProfileProvider, useProfile } from "./components/ProfileContext";
import SummaryCard from "./components/SummaryCard";
import DrDistribution from "./components/charts/DrDistribution";
import VelocityChart from "./components/charts/VelocityChart";
import ScatterPlot from "./components/charts/ScatterPlot";
import DataTable from "./components/tables/DataTable";
import {
  fetchOverview,
  fetchDrDistribution,
  fetchVelocity,
  fetchLinks,
  fetchReferringDomains,
  fetchAnchors,
  fetchQualityMatrix,
  type OverviewData,
  type DrBucket,
  type VelocityPoint,
  type LinkRecord,
  type ReferringDomain,
  type AnchorRecord,
  type QualityPoint,
  type LinksResponse,
} from "./lib/api";
import type { ColumnDef } from "@tanstack/react-table";

const linkColumns: ColumnDef<LinkRecord, unknown>[] = [
  { accessorKey: "referring_domain", header: "Referring Domain" },
  { accessorKey: "anchor", header: "Anchor" },
  { accessorKey: "target_path", header: "Target" },
  { accessorKey: "domain_rating", header: "DR" },
  { accessorKey: "page_traffic", header: "Traffic" },
  { accessorKey: "link_type", header: "Type" },
  {
    accessorKey: "is_nofollow",
    header: "Nofollow",
    cell: ({ getValue }) => (getValue() ? "Yes" : ""),
  },
  {
    accessorKey: "is_spam",
    header: "Spam",
    cell: ({ getValue }) => (getValue() ? "Yes" : ""),
  },
  { accessorKey: "first_seen", header: "First Seen" },
];

const domainColumns: ColumnDef<ReferringDomain, unknown>[] = [
  { accessorKey: "referring_domain", header: "Domain" },
  { accessorKey: "link_count", header: "Links" },
  { accessorKey: "max_dr", header: "DR" },
  { accessorKey: "total_traffic", header: "Traffic" },
  { accessorKey: "dominant_anchor", header: "Top Anchor" },
  {
    accessorKey: "is_sitewide",
    header: "Sitewide",
    cell: ({ getValue }) => (getValue() ? "Yes" : ""),
  },
];

const anchorColumns: ColumnDef<AnchorRecord, unknown>[] = [
  { accessorKey: "anchor", header: "Anchor Text" },
  { accessorKey: "count", header: "Count" },
  { accessorKey: "category", header: "Category" },
  {
    accessorKey: "pct",
    header: "%",
    cell: ({ getValue }) => `${(getValue() as number).toFixed(1)}%`,
  },
];

type Tab = "overview" | "links" | "domains" | "anchors" | "quality";

function Dashboard() {
  const { profiles, selected, setSelected, loading, error } = useProfile();
  const [tab, setTab] = useState<Tab>("overview");

  // Overview state
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [drDist, setDrDist] = useState<DrBucket[]>([]);
  const [velocity, setVelocity] = useState<VelocityPoint[]>([]);

  // Links state
  const [linksData, setLinksData] = useState<LinksResponse | null>(null);
  const [linkPage, setLinkPage] = useState(0);

  // Domains state
  const [domains, setDomains] = useState<ReferringDomain[]>([]);

  // Anchors state
  const [anchors, setAnchors] = useState<AnchorRecord[]>([]);

  // Quality state
  const [quality, setQuality] = useState<QualityPoint[]>([]);

  useEffect(() => {
    if (!selected) return;
    if (tab === "overview") {
      fetchOverview(selected).then(setOverview).catch(() => setOverview(null));
      fetchDrDistribution(selected).then(setDrDist).catch(() => setDrDist([]));
      fetchVelocity(selected).then(setVelocity).catch(() => setVelocity([]));
    } else if (tab === "links") {
      fetchLinks(selected, { page: linkPage + 1, page_size: 50 })
        .then(setLinksData)
        .catch(() => setLinksData(null));
    } else if (tab === "domains") {
      fetchReferringDomains(selected).then(setDomains).catch(() => setDomains([]));
    } else if (tab === "anchors") {
      fetchAnchors(selected).then(setAnchors).catch(() => setAnchors([]));
    } else if (tab === "quality") {
      fetchQualityMatrix(selected).then((r) => setQuality(r.items)).catch(() => setQuality([]));
    }
  }, [selected, tab, linkPage]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;
  }

  if (profiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">No profiles found</p>
          {error && <p className="text-sm mt-2 text-red-500">Error: {error}</p>}
          <p className="text-sm mt-2">Ingest some backlink data first, then restart the backend.</p>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "links", label: "Links" },
    { key: "domains", label: "Domains" },
    { key: "anchors", label: "Anchors" },
    { key: "quality", label: "Quality" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Backlink Analyser</h1>
          <select
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.profile_label} value={p.profile_label}>
                {p.profile_label} ({p.total_links.toLocaleString()} links)
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-6 max-w-7xl mx-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {tab === "overview" && overview && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard label="Total Backlinks" value={overview.total_backlinks.toLocaleString()} />
              <SummaryCard label="Referring Domains" value={overview.unique_referring_domains.toLocaleString()} />
              <SummaryCard label="Dofollow" value={overview.dofollow_count.toLocaleString()} color="text-green-600" />
              <SummaryCard label="Avg DR" value={overview.avg_dr?.toFixed(1) ?? "—"} />
              <SummaryCard label="Nofollow" value={overview.nofollow_count.toLocaleString()} />
              <SummaryCard label="Spam Ratio" value={`${(overview.spam_ratio * 100).toFixed(1)}%`} color={overview.spam_ratio > 0.1 ? "text-red-600" : "text-green-600"} />
              <SummaryCard label="Image Links" value={overview.image_link_count.toLocaleString()} />
              <SummaryCard label="Total Traffic" value={overview.total_page_traffic.toLocaleString()} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DrDistribution data={drDist} />
              <VelocityChart data={velocity} />
            </div>
          </div>
        )}

        {tab === "links" && (
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">All Backlinks</h3>
            <DataTable
              data={linksData?.items ?? []}
              columns={linkColumns}
              pageSize={50}
              manualPagination
              pageCount={linksData ? Math.ceil(linksData.total / 50) : 1}
              pageIndex={linkPage}
              onPageChange={setLinkPage}
            />
          </div>
        )}

        {tab === "domains" && (
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Referring Domains</h3>
            <DataTable data={domains} columns={domainColumns} pageSize={30} />
          </div>
        )}

        {tab === "anchors" && (
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Anchor Text Distribution</h3>
            <DataTable data={anchors} columns={anchorColumns} pageSize={30} />
          </div>
        )}

        {tab === "quality" && (
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Quality Matrix (DR vs Traffic)</h3>
            <ScatterPlot data={quality} />
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <ProfileProvider>
      <Dashboard />
    </ProfileProvider>
  );
}

export default App;
