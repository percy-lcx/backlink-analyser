import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import type { PageRow } from "../../lib/api";
import Tooltip from "../Tooltip";
import { METRICS } from "../../lib/metrics";

interface Props {
  data: PageRow[];
  onBarClick?: (targetPath: string) => void;
}

function truncatePath(path: string, maxLen = 40): string {
  if (path.length <= maxLen) return path;
  return "..." + path.slice(-maxLen);
}

export default function TopPagesChart({ data, onBarClick }: Props) {
  const top = data.slice(0, 15).map((d) => ({
    ...d,
    label: truncatePath(d.target_path),
  }));

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        <Tooltip text={METRICS.top_pages_chart.short}>Top Pages by Backlinks</Tooltip>
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={top}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          onClick={onBarClick ? (state: any) => {
            if (state?.activeLabel) {
              const match = top.find((d) => d.label === state.activeLabel);
              if (match) onBarClick(match.target_path);
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
            formatter={(value: any) => [Number(value).toLocaleString(), "Backlinks"]}
            labelFormatter={(label: any) => {
              const match = top.find((d) => d.label === label);
              return match ? match.target_path : label;
            }}
          />
          <Bar dataKey="link_count" name="Backlinks" fill="#6366f1" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
