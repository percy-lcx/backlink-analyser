import { useState, useEffect } from "react";
import {
  fetchOverview,
  fetchDrDistribution,
  fetchVelocity,
  type OverviewData,
  type DrBucket,
  type VelocityPoint,
} from "../../lib/api";
import SummaryCard from "../SummaryCard";
import DrDistribution from "../charts/DrDistribution";
import VelocityChart from "../charts/VelocityChart";
import LoadingSpinner from "../LoadingSpinner";
import { METRICS } from "../../lib/metrics";

interface OverviewTabProps {
  profile: string;
}

export default function OverviewTab({ profile }: OverviewTabProps) {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [drDist, setDrDist] = useState<DrBucket[]>([]);
  const [velocity, setVelocity] = useState<VelocityPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchOverview(profile),
      fetchDrDistribution(profile).then((d) => d.dr ?? []),
      fetchVelocity(profile),
    ])
      .then(([ov, dr, vel]) => {
        setOverview(ov);
        setDrDist(dr);
        setVelocity(vel);
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Backlinks" value={(overview.total_backlinks ?? 0).toLocaleString()} tooltip={METRICS.total_backlinks.short} />
        <SummaryCard label="Referring Domains" value={(overview.unique_referring_domains ?? 0).toLocaleString()} tooltip={METRICS.referring_domains.short} />
        <SummaryCard label="Dofollow" value={(overview.dofollow_count ?? 0).toLocaleString()} color="text-green-600" tooltip={METRICS.dofollow.short} />
        <SummaryCard label="Avg DR" value={overview.avg_dr?.toFixed(1) ?? "—"} tooltip={METRICS.avg_dr.short} />
        <SummaryCard label="Nofollow" value={(overview.nofollow_count ?? 0).toLocaleString()} tooltip={METRICS.nofollow.short} />
        <SummaryCard label="Spam Ratio" value={`${((overview.spam_ratio ?? 0) * 100).toFixed(1)}%`} color={(overview.spam_ratio ?? 0) > 0.1 ? "text-red-600" : "text-green-600"} tooltip={METRICS.spam_ratio.short} />
        <SummaryCard label="Image Links" value={(overview.image_link_count ?? 0).toLocaleString()} tooltip={METRICS.image_links.short} />
        <SummaryCard label="Total Backlink Traffic" value={(overview.total_page_traffic ?? 0).toLocaleString()} tooltip={METRICS.total_backlink_traffic.short} />
        <SummaryCard label="Newest Backlink" value={overview.newest_backlink_date ? new Date(overview.newest_backlink_date).toLocaleDateString() : "—"} tooltip={METRICS.newest_backlink.short} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DrDistribution data={drDist} />
        <VelocityChart data={velocity} />
      </div>
    </div>
  );
}
