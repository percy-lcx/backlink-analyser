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
  onViewAll?: () => void;
}

export default function PageCategoryChart({ data, onBarClick, onViewAll }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          <Tooltip text={METRICS.page_category_chart.short}>Backlinks by Category</Tooltip>
        </h3>
        {onViewAll && (
          <button onClick={onViewAll} className="text-xs text-primary-500 hover:text-primary-700 font-medium cursor-pointer">
            View all &rarr;
          </button>
        )}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          onClick={onBarClick ? (state: { activeLabel?: string | number }) => {
            if (state?.activeLabel != null) onBarClick(String(state.activeLabel));
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
