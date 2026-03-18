import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import type { AnchorRecord } from "../../lib/api";
import Tooltip from "../Tooltip";
import { METRICS } from "../../lib/metrics";

const CATEGORY_COLORS: Record<string, string> = {
  branded: "#001489",
  brand_keyword: "#7c3aed",
  exact_match: "#ef4444",
  partial_match: "#f59e0b",
  generic: "#6b7280",
  image: "#8b5cf6",
  naked_url: "#14b8a6",
  empty: "#e5e7eb",
  other: "#d1d5db",
};

interface Props {
  data: AnchorRecord[];
  onBarClick?: (anchor: string) => void;
}

function truncateAnchor(text: string, maxLen = 40): string {
  if (!text) return "(empty)";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "…";
}

export default function TopAnchorsChart({ data, onBarClick }: Props) {
  const top = data.slice(0, 15).map((d) => ({
    ...d,
    label: truncateAnchor(d.anchor),
  }));

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        <Tooltip text={METRICS.top_anchors_chart.short}>Top Anchors by Count</Tooltip>
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={top}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={onBarClick ? (state: any) => {
            if (state?.activeLabel) {
              const match = top.find((d) => d.label === state.activeLabel);
              if (match) onBarClick(match.anchor);
            }
          } : undefined}
          style={onBarClick ? { cursor: "pointer" } : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 11 }}
            width={180}
          />
          <RechartsTooltip
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
            formatter={(value) => [(Number(value) || 0).toLocaleString(), "Links"]}
            labelFormatter={(label) => {
              const match = top.find((d) => d.label === label);
              return match ? match.anchor : label;
            }}
          />
          <Bar dataKey="count" name="Links" radius={[0, 4, 4, 0]}>
            {top.map((entry, index) => (
              <Cell key={index} fill={CATEGORY_COLORS[entry.category] ?? "#6366f1"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
