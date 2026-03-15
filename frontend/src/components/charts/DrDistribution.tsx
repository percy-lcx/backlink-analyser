import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import type { DrBucket } from "../../lib/api";
import Tooltip from "../Tooltip";
import { METRICS } from "../../lib/metrics";

interface Props {
  data: DrBucket[];
  maxCount?: number;
  onBarClick?: (bucket: string) => void;
  onViewAll?: () => void;
}

export default function DrDistribution({ data, maxCount, onBarClick, onViewAll }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          <Tooltip text={METRICS.dr_distribution.short}>DR Distribution</Tooltip>
        </h3>
        {onViewAll && (
          <button onClick={onViewAll} className="text-xs text-primary-500 hover:text-primary-700 font-medium">
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
          <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} domain={maxCount !== undefined ? [0, maxCount] : undefined} />
          <RechartsTooltip
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <Bar
            dataKey="count"
            fill="#6366f1"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
