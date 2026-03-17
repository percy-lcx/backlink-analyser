import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import Tooltip from "../Tooltip";

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

const CATEGORY_LABELS: Record<string, string> = {
  branded: "Branded",
  brand_keyword: "Brand + Keyword",
  exact_match: "Exact Match",
  partial_match: "Partial Match",
  generic: "Generic",
  image: "Image",
  naked_url: "Naked URL",
  empty: "Empty",
  other: "Other",
};

interface Props {
  categories: Record<string, number>;
}

export default function AnchorCategoryDonut({ categories }: Props) {
  const data = Object.entries(categories)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: CATEGORY_LABELS[key] ?? key, value, key }))
    .sort((a, b) => b.value - a.value);

  const total = data.reduce((s, d) => s + d.value, 0);
  const exactPct = total > 0 ? ((categories["exact_match"] ?? 0) / total) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          <Tooltip text="Distribution of anchor text types across all backlinks.">Anchor Categories</Tooltip>
        </h3>
        {exactPct > 40 && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
            Exact match {exactPct.toFixed(0)}%
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={CATEGORY_COLORS[entry.key] ?? "#d1d5db"} />
            ))}
          </Pie>
          <RechartsTooltip
            formatter={(value) => {
              const num = Number(value) || 0;
              const pct = total > 0 ? ((num / total) * 100).toFixed(1) : "0";
              return [`${num.toLocaleString()} (${pct}%)`, "Links"];
            }}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <Legend
            formatter={(value: string) => <span className="text-xs text-gray-600">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
