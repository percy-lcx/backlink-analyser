import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { PageRow } from "../../lib/api";
import Tooltip from "../Tooltip";
import { METRICS } from "../../lib/metrics";

interface Props {
  data: PageRow[];
}

const CATEGORY_COLORS: Record<string, string> = {
  homepage: "#6366f1",
  content: "#22c55e",
  money_pages: "#f59e0b",
  other: "#9ca3af",
};

export default function PageScatterPlot({ data }: Props) {
  const groups = new Map<string, PageRow[]>();
  for (const row of data) {
    const cat = row.category;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(row);
  }

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        <Tooltip text={METRICS.page_scatter.short}>Pages: Ref. Domains vs Backlinks</Tooltip>
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            dataKey="unique_referring_domains"
            name="Ref. Domains"
            tick={{ fontSize: 12 }}
            label={{ value: "Referring Domains", position: "insideBottom", offset: -5, fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="link_count"
            name="Backlinks"
            tick={{ fontSize: 12 }}
            label={{ value: "Backlinks", angle: -90, position: "insideLeft", fontSize: 12 }}
          />
          <RechartsTooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null;
              const d = payload[0].payload as PageRow;
              return (
                <div className="bg-white rounded-lg border border-gray-200 p-2 text-xs shadow">
                  <p className="font-medium text-gray-800 mb-1 max-w-[300px] truncate">{d.target_path}</p>
                  <p>Backlinks: {d.link_count.toLocaleString()}</p>
                  <p>Ref. Domains: {d.unique_referring_domains.toLocaleString()}</p>
                  <p>Avg DR: {d.avg_dr?.toFixed(1) ?? "—"}</p>
                  <p>Category: {d.category}</p>
                </div>
              );
            }}
          />
          <Legend />
          {Array.from(groups.entries()).map(([cat, rows]) => (
            <Scatter
              key={cat}
              name={cat}
              data={rows}
              fill={CATEGORY_COLORS[cat] ?? "#9ca3af"}
              opacity={0.7}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
