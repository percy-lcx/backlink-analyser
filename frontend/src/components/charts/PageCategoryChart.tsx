import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import Tooltip from "../Tooltip";
import { METRICS } from "../../lib/metrics";

interface CategoryDatum {
  category: string;
  link_count: number;
}

interface Props {
  data: CategoryDatum[];
  onBarClick?: (category: string) => void;
}

export default function PageCategoryChart({ data, onBarClick }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        <Tooltip text={METRICS.page_category_chart.short}>Backlinks by Category</Tooltip>
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          onClick={onBarClick ? (state: { activeLabel?: string }) => {
            if (state?.activeLabel) onBarClick(state.activeLabel);
          } : undefined}
          style={onBarClick ? { cursor: "pointer" } : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="category" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <RechartsTooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <Bar dataKey="link_count" name="Backlinks" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
