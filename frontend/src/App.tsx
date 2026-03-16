import { useState } from "react";
import { useProfile } from "./components/ProfileContext";
import OverviewTab from "./components/tabs/OverviewTab";
import LinksTab from "./components/tabs/LinksTab";
import DomainsTab from "./components/tabs/DomainsTab";
import AnchorsTab from "./components/tabs/AnchorsTab";
import PagesTab from "./components/tabs/PagesTab";
import QualityTab from "./components/tabs/QualityTab";
import CompareTab from "./components/CompareTab";
import IntersectTab from "./components/IntersectTab";
import BrokenLinksTab from "./components/BrokenLinksTab";
import TerminologyTab from "./components/TerminologyTab";
import { triggerIngest, type LinksDrilldown } from "./lib/api";

type Tab = "overview" | "links" | "domains" | "anchors" | "pages" | "quality" | "compare" | "intersect" | "broken" | "terminology";

function Dashboard() {
  const { profiles, selected, setSelected, loading, error, refresh } = useProfile();
  const [tab, setTab] = useState<Tab>("overview");
  const [drilldown, setDrilldown] = useState<LinksDrilldown | null>(null);
  const [pageCategory, setPageCategory] = useState<string | null>(null);

  // Ingest state
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);

  const handleIngest = async () => {
    setIngesting(true);
    setIngestMsg(null);
    try {
      const result = await triggerIngest();
      setIngestMsg(result.status === "ok" ? "Ingestion complete" : `Status: ${result.status}`);
      refresh();
    } catch (err) {
      setIngestMsg(`Failed: ${err}`);
    } finally {
      setIngesting(false);
    }
  };

  const handleDrilldown = (d: LinksDrilldown) => {
    setDrilldown(d);
    setTab("links");
  };

  const handleTabClick = (t: Tab) => {
    if (t === "links") setDrilldown(null);
    if (t === "pages") setPageCategory(null);
    setTab(t);
  };

  const handlePageCategory = (category: string) => {
    setPageCategory(category);
    setTab("pages");
  };

  const handleGapRowClick = (profileLabel: string, referringDomain: string, targetPath?: string) => {
    setSelected(profileLabel);
    handleDrilldown({
      domain: referringDomain,
      ...(targetPath ? { targetPath, targetPathMode: "exact" as const } : {}),
    });
  };

  const handleDrBarClick = (profileLabel: string, drMin: number, drMax: number, targetPath?: string) => {
    setSelected(profileLabel);
    handleDrilldown({
      drMin: String(drMin),
      drMax: String(drMax),
      ...(targetPath ? { targetPath, targetPathMode: "exact" as const } : {}),
    });
  };

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
          <button
            className="mt-4 px-3 py-1.5 bg-primary-500 text-white rounded-md text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
            onClick={handleIngest}
            disabled={ingesting}
          >
            {ingesting ? "Ingesting..." : "Run Ingestion"}
          </button>
          {ingestMsg && <p className="text-sm mt-2 text-gray-600">{ingestMsg}</p>}
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "links", label: "Links" },
    { key: "domains", label: "Domains" },
    { key: "anchors", label: "Anchors" },
    { key: "pages", label: "Pages" },
    { key: "quality", label: "Quality" },
    { key: "compare", label: "Compare" },
    { key: "intersect", label: "Intersect" },
    { key: "broken", label: "Broken Links" },
    { key: "terminology", label: "Terminology" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Backlink Analyser</h1>
          <div className="flex items-center gap-3">
            <button
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={handleIngest}
              disabled={ingesting}
            >
              {ingesting ? "Ingesting..." : "Re-ingest"}
            </button>
            {ingestMsg && <span className="text-xs text-gray-500">{ingestMsg}</span>}
            <select
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {profiles.map((p) => (
                <option key={p.profile_label} value={p.profile_label}>
                  {p.profile_label} ({(p.total_links ?? 0).toLocaleString()} links)
                </option>
              ))}
            </select>
          </div>
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
                  ? "border-primary-500 text-primary-500"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => handleTabClick(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {tab === "overview" && <OverviewTab profile={selected} onTabClick={(t) => handleTabClick(t as Tab)} onDrilldown={handleDrilldown} onPageCategory={handlePageCategory} />}
        {tab === "links" && <LinksTab profile={selected} drilldown={drilldown} />}
        {tab === "domains" && <DomainsTab profile={selected} onDrilldown={handleDrilldown} />}
        {tab === "anchors" && <AnchorsTab profile={selected} onDrilldown={handleDrilldown} />}
        {tab === "pages" && <PagesTab profile={selected} onDrilldown={handleDrilldown} initialCategory={pageCategory} />}
        {tab === "quality" && <QualityTab profile={selected} />}
        <div style={{ display: tab === "compare" ? undefined : "none" }}>
          <CompareTab onDrBarClick={handleDrBarClick} onGapRowClick={handleGapRowClick} />
        </div>
        <div style={{ display: tab === "intersect" ? undefined : "none" }}>
          <IntersectTab />
        </div>
        {tab === "broken" && <BrokenLinksTab />}
        {tab === "terminology" && <TerminologyTab />}
      </main>
    </div>
  );
}

export default Dashboard;
