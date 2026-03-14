import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import type { CompareProfile } from "../../lib/api";
import Tooltip from "../Tooltip";
import { METRICS } from "../../lib/metrics";

interface Props {
  data: CompareProfile[];
}

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4"];

const RADAR_METRICS: { key: keyof CompareProfile; label: string }[] = [
  { key: "total_links", label: "Backlinks" },
  { key: "referring_domains", label: "Domains" },
  { key: "dofollow_ratio", label: "Dofollow %" },
  { key: "avg_dr", label: "Avg DR" },
  { key: "anchor_diversity", label: "Anchor Diversity" },
];

function normalize(values: number[]): number[] {
  const max = Math.max(...values, 1);
  return values.map((v) => Math.round((v / max) * 100));
}

export default function RadarCompare({ data }: Props) {
  if (data.length === 0) return null;

  // Build radar data: one entry per metric, each profile as a value
  const radarData = RADAR_METRICS.map((m) => {
    const raw = data.map((d) => Number(d[m.key]) || 0);
    const norm = normalize(raw);
    const entry: Record<string, string | number> = { metric: m.label };
    data.forEach((d, i) => {
      entry[d.profile_label] = norm[i];
    });
    return entry;
  });

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        <Tooltip text={METRICS.profile_comparison.short}>Profile Comparison (Normalized)</Tooltip>
      </h3>
      <ResponsiveContainer width="100%" height={380}>
        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <RechartsTooltip />
          {data.map((d, i) => (
            <Radar
              key={d.profile_label}
              name={d.profile_label}
              dataKey={d.profile_label}
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.15}
            />
          ))}
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
