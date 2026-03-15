import { useState, useEffect } from "react";
import {
  fetchOverview,
  fetchDrDistribution,
  fetchVelocity,
  fetchBrokenLinks,
  fetchSitewide,
  fetchRedirects,
  fetchAnchors,
  fetchPageBreakdown,
  fetchReferringDomains,
  type OverviewData,
  type DrBucket,
  type VelocityPoint,
  type BrokenLinksSummary,
  type RedirectSummary,
  type PageBreakdownResponse,
  type PageRow,
  type ReferringDomain,
} from "../../lib/api";
import SummaryCard from "../SummaryCard";
import AlertCard from "../AlertCard";
import DrDistribution from "../charts/DrDistribution";
import VelocityChart from "../charts/VelocityChart";
import AnchorCategoryDonut from "../charts/AnchorCategoryDonut";
import PageCategoryChart from "../charts/PageCategoryChart";
import TopDomainsTable from "../TopDomainsTable";
import TopPagesTable from "../TopPagesTable";
import LoadingSpinner from "../LoadingSpinner";
import { METRICS } from "../../lib/metrics";

interface OverviewTabProps {
  profile: string;
  onTabClick?: (tab: string) => void;
}

export default function OverviewTab({ profile, onTabClick }: OverviewTabProps) {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [drDist, setDrDist] = useState<DrBucket[]>([]);
  const [velocity, setVelocity] = useState<VelocityPoint[]>([]);
  const [broken, setBroken] = useState<BrokenLinksSummary | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sitewide, setSitewide] = useState<any>(null);
  const [redirects, setRedirects] = useState<RedirectSummary | null>(null);
  const [anchorCats, setAnchorCats] = useState<Record<string, number>>({});
  const [pageCats, setPageCats] = useState<PageBreakdownResponse["categories"]>({});
  const [topPages, setTopPages] = useState<PageRow[]>([]);
  const [topDomains, setTopDomains] = useState<ReferringDomain[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchOverview(profile),
      fetchDrDistribution(profile).then((d) => d.dr ?? []),
      fetchVelocity(profile),
      fetchBrokenLinks(profile, { per_page: 1 }).then((r) => r.summary).catch(() => null),
      fetchSitewide(profile).catch(() => null),
      fetchRedirects(profile).catch(() => null),
      fetchAnchors(profile).then((r) => r.categories ?? {}).catch(() => ({})),
      fetchPageBreakdown(profile).catch(() => ({ pages: [], categories: {} } as PageBreakdownResponse)),
      fetchReferringDomains(profile, { sort: "max_dr:desc" }).catch(() => []),
    ])
      .then(([ov, dr, vel, brk, sw, redir, aCats, pageData, doms]) => {
        setOverview(ov);
        setDrDist(dr);
        setVelocity(vel);
        setBroken(brk as BrokenLinksSummary | null);
        setSitewide(sw);
        setRedirects(redir as RedirectSummary | null);
        setAnchorCats(aCats as Record<string, number>);
        const pd = pageData as PageBreakdownResponse;
        setPageCats(pd.categories ?? {});
        setTopPages(pd.pages ?? []);
        setTopDomains(doms as ReferringDomain[]);
      })
      .catch(() => {
        setOverview(null);
        setDrDist([]);
        setVelocity([]);
      })
      .finally(() => setLoading(false));
  }, [profile]);

  if (loading) return <LoadingSpinner message="Loading overview..." />;
  if (!overview) return <LoadingSpinner message="Loading overview..." />;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard label="Total Backlinks" value={(overview.total_backlinks ?? 0).toLocaleString()} tooltip={METRICS.total_backlinks.short} />
        <SummaryCard label="Referring Domains" value={(overview.unique_referring_domains ?? 0).toLocaleString()} tooltip={METRICS.referring_domains.short} />
        <SummaryCard
          label="Dofollow"
          value={(overview.dofollow_count ?? 0).toLocaleString()}
          subtitle={overview.total_backlinks ? `${((overview.dofollow_count / overview.total_backlinks) * 100).toFixed(0)}% of total` : undefined}
          color="text-green-600"
          tooltip={METRICS.dofollow.short}
        />
        <SummaryCard
          label="Avg DR"
          value={overview.avg_dr?.toFixed(1) ?? "—"}
          subtitle={overview.median_dr != null ? `Median: ${overview.median_dr.toFixed(1)}` : undefined}
          tooltip={METRICS.avg_dr.short}
        />
        <SummaryCard
          label="Nofollow"
          value={(overview.nofollow_count ?? 0).toLocaleString()}
          subtitle={`UGC: ${(overview.ugc_count ?? 0).toLocaleString()} / Sponsored: ${(overview.sponsored_count ?? 0).toLocaleString()}`}
          tooltip={METRICS.nofollow.short}
        />
        <SummaryCard label="Spam Ratio" value={`${((overview.spam_ratio ?? 0) * 100).toFixed(1)}%`} color={(overview.spam_ratio ?? 0) > 0.1 ? "text-red-600" : "text-green-600"} tooltip={METRICS.spam_ratio.short} />
        <SummaryCard
          label="Text / Image"
          value={(overview.text_link_count ?? 0).toLocaleString()}
          subtitle={`Image: ${(overview.image_link_count ?? 0).toLocaleString()}`}
          tooltip={METRICS.image_links.short}
        />
        <SummaryCard label="Total Backlink Traffic" value={(overview.total_page_traffic ?? 0).toLocaleString()} tooltip={METRICS.total_backlink_traffic.short} />
        <SummaryCard label="Newest Backlink" value={overview.newest_backlink_date ? new Date(overview.newest_backlink_date).toLocaleDateString() : "—"} tooltip={METRICS.newest_backlink.short} />
      </div>

      {/* Link Health alerts */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Link Health</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AlertCard
            label="Broken Links"
            value={broken ? broken.total_broken.toLocaleString() : "—"}
            subtitle={broken ? `4xx: ${broken.count_4xx} / 5xx: ${broken.count_5xx}` : undefined}
            status={!broken || broken.total_broken === 0 ? "ok" : broken.total_broken <= 10 ? "warning" : "danger"}
            tooltip={METRICS.broken_links_alert.short}
            onClick={onTabClick ? () => onTabClick("broken") : undefined}
          />
          <AlertCard
            label="Sitewide Links"
            value={(() => {
              const sw = sitewide?.aggregate?.sitewide ?? sitewide?.with_sitewide;
              return sw ? (sw.link_count ?? sw.total_links ?? 0).toLocaleString() : "0";
            })()}
            subtitle={(() => {
              const sw = sitewide?.aggregate?.sitewide ?? sitewide?.with_sitewide;
              return sw ? `${sw.unique_domains ?? 0} domains` : undefined;
            })()}
            status={(() => {
              const sw = sitewide?.aggregate?.sitewide ?? sitewide?.with_sitewide;
              if (!sw || !overview.total_backlinks) return "ok";
              const links = sw.link_count ?? sw.total_links ?? 0;
              const ratio = links / overview.total_backlinks;
              return ratio > 0.5 ? "danger" : ratio > 0.3 ? "warning" : "ok";
            })()}
            tooltip={METRICS.sitewide_alert.short}
          />
          <AlertCard
            label="Redirect Issues"
            value={redirects ? redirects.total_with_redirects.toLocaleString() : "—"}
            subtitle={redirects && overview.total_backlinks ? `${((redirects.total_with_redirects / overview.total_backlinks) * 100).toFixed(1)}% of links` : undefined}
            status={(() => {
              if (!redirects || redirects.total_with_redirects === 0) return "ok";
              const pct = overview.total_backlinks ? (redirects.total_with_redirects / overview.total_backlinks) * 100 : 0;
              return pct > 10 ? "danger" : "warning";
            })()}
            tooltip={METRICS.redirect_alert.short}
          />
          <AlertCard
            label="Spam Count"
            value={Math.round((overview.spam_ratio ?? 0) * (overview.total_backlinks ?? 0)).toLocaleString()}
            subtitle={`${((overview.spam_ratio ?? 0) * 100).toFixed(1)}% of total`}
            status={(overview.spam_ratio ?? 0) > 0.1 ? "danger" : (overview.spam_ratio ?? 0) > 0.05 ? "warning" : "ok"}
            tooltip={METRICS.spam_ratio.short}
          />
        </div>
      </div>

      {/* Anchor & Page category charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnchorCategoryDonut categories={anchorCats} />
        <PageCategoryChart
          data={Object.entries(pageCats).map(([category, stats]) => ({ category, link_count: stats.link_count }))}
        />
      </div>

      {/* DR Distribution & Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DrDistribution data={drDist} />
        <VelocityChart data={velocity} />
      </div>

      {/* Top Domains & Top Pages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopDomainsTable domains={topDomains} onViewAll={onTabClick ? () => onTabClick("domains") : undefined} />
        <TopPagesTable pages={topPages} onViewAll={onTabClick ? () => onTabClick("pages") : undefined} />
      </div>
    </div>
  );
}
