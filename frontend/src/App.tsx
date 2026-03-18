import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useParams, useNavigate, Link } from "react-router-dom";
import { useProfile } from "./components/ProfileContext";
import OverviewTab from "./components/tabs/OverviewTab";
import LinksTab from "./components/tabs/LinksTab";
import DomainsTab from "./components/tabs/DomainsTab";
import AnchorsTab from "./components/tabs/AnchorsTab";
import PagesTab from "./components/tabs/PagesTab";
import CompareTab from "./components/CompareTab";
import IntersectTab from "./components/IntersectTab";
import BrokenLinksTab from "./components/BrokenLinksTab";
import TerminologyTab from "./components/TerminologyTab";
import SettingsTab from "./components/tabs/SettingsTab";
import { triggerIngest, type LinksDrilldown } from "./lib/api";

type Tab = "overview" | "links" | "domains" | "anchors" | "pages" | "compare" | "intersect" | "broken" | "settings" | "terminology";

const tabs: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "links", label: "Links" },
  { key: "domains", label: "Domains" },
  { key: "anchors", label: "Anchors" },
  { key: "pages", label: "Pages" },
  { key: "compare", label: "Compare" },
  { key: "intersect", label: "Intersect" },
  { key: "broken", label: "Broken Links" },
  { key: "settings", label: "Settings" },
  { key: "terminology", label: "Terminology" },
];

const VALID_TABS = new Set<string>(tabs.map((t) => t.key));

function isValidTab(t: string): t is Tab {
  return VALID_TABS.has(t);
}

function profilePath(profile: string, tab: string = "overview") {
  return `/${encodeURIComponent(profile)}/${tab}`;
}

/** Redirects unknown routes to the first profile's overview */
function DefaultRedirect() {
  const { profiles, loading } = useProfile();
  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;
  }
  if (profiles.length === 0) return <Navigate to="/no-profiles" replace />;
  return <Navigate to={profilePath(profiles[0].profile_label)} replace />;
}

function DashboardContent() {
  const { profile: urlProfile, tab: urlTab } = useParams<{ profile: string; tab: string }>();
  const navigate = useNavigate();
  const { profiles, selected, setSelected, loading, error, refresh } = useProfile();
  const [drilldown, setDrilldown] = useState<LinksDrilldown | null>(null);
  const [pageCategory, setPageCategory] = useState<string | null>(null);

  // Ingest state
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);

  const decodedProfile = urlProfile ? decodeURIComponent(urlProfile) : "";
  const currentTab: Tab = urlTab && isValidTab(urlTab) ? urlTab : "overview";

  // Sync URL profile → ProfileContext
  useEffect(() => {
    if (decodedProfile && decodedProfile !== selected && profiles.some((p) => p.profile_label === decodedProfile)) {
      setSelected(decodedProfile);
    }
  }, [decodedProfile, selected, profiles, setSelected]);

  // Dynamic browser tab title
  useEffect(() => {
    const tabLabel = tabs.find((t) => t.key === currentTab)?.label ?? "Overview";
    document.title = `${decodedProfile} – ${tabLabel} | Backlink Analyser`;
  }, [decodedProfile, currentTab]);

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
    navigate(profilePath(decodedProfile, "links"));
  };

  const handleTabClick = (t: Tab) => {
    if (t === "links") setDrilldown(null);
    if (t === "pages") setPageCategory(null);
    navigate(profilePath(decodedProfile, t));
  };

  const handlePageCategory = (category: string) => {
    setPageCategory(category);
    navigate(profilePath(decodedProfile, "pages"));
  };

  const handleGapRowClick = (profileLabel: string, referringDomain: string, targetPath?: string) => {
    setSelected(profileLabel);
    setDrilldown({
      domain: referringDomain,
      ...(targetPath ? { targetPath, targetPathMode: "exact" as const } : {}),
    });
    navigate(profilePath(profileLabel, "links"));
  };

  const handleDrBarClick = (profileLabel: string, drMin: number, drMax: number, targetPath?: string) => {
    setSelected(profileLabel);
    setDrilldown({
      drMin: String(drMin),
      drMax: String(drMax),
      ...(targetPath ? { targetPath, targetPathMode: "exact" as const } : {}),
    });
    navigate(profilePath(profileLabel, "links"));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;
  }

  // Validate profile from URL
  if (!profiles.some((p) => p.profile_label === decodedProfile)) {
    return <Navigate to={profilePath(profiles[0]?.profile_label ?? "")} replace />;
  }

  // Validate tab from URL
  if (urlTab && !isValidTab(urlTab)) {
    return <Navigate to={profilePath(decodedProfile)} replace />;
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
              value={decodedProfile}
              onChange={(e) => navigate(profilePath(e.target.value, currentTab))}
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

      {/* Tabs — using <Link> so middle-click / ctrl+click opens in new browser tab */}
      <nav className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-6 max-w-7xl mx-auto">
          {tabs.map((t) => (
            <Link
              key={t.key}
              to={profilePath(decodedProfile, t.key)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                currentTab === t.key
                  ? "border-primary-500 text-primary-500"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={(e) => {
                // For normal clicks, use navigate to preserve drilldown clearing logic
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                  e.preventDefault();
                  handleTabClick(t.key);
                }
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {currentTab === "overview" && <OverviewTab profile={decodedProfile} onTabClick={(t) => handleTabClick(t as Tab)} onDrilldown={handleDrilldown} onPageCategory={handlePageCategory} />}
        {currentTab === "links" && <LinksTab profile={decodedProfile} drilldown={drilldown} />}
        {currentTab === "domains" && <DomainsTab profile={decodedProfile} onDrilldown={handleDrilldown} />}
        {currentTab === "anchors" && <AnchorsTab profile={decodedProfile} onDrilldown={handleDrilldown} />}
        {currentTab === "pages" && <PagesTab profile={decodedProfile} onDrilldown={handleDrilldown} initialCategory={pageCategory} />}
        <div style={{ display: currentTab === "compare" ? undefined : "none" }}>
          <CompareTab profile={decodedProfile} onDrBarClick={handleDrBarClick} onGapRowClick={handleGapRowClick} />
        </div>
        <div style={{ display: currentTab === "intersect" ? undefined : "none" }}>
          <IntersectTab profile={decodedProfile} />
        </div>
        {currentTab === "broken" && <BrokenLinksTab />}
        {currentTab === "settings" && <SettingsTab />}
        {currentTab === "terminology" && <TerminologyTab />}
      </main>
    </div>
  );
}

function Dashboard() {
  return (
    <Routes>
      <Route path="/:profile/:tab" element={<DashboardContent />} />
      <Route path="/:profile" element={<DashboardContent />} />
      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
}

export default Dashboard;
