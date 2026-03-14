import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { VelocityPoint } from "../../lib/api";
import Tooltip from "../Tooltip";
import { METRICS } from "../../lib/metrics";

interface Props {
  data: VelocityPoint[];
}

export default function VelocityChart({ data }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        <Tooltip text={METRICS.link_velocity.short}>Link Velocity</Tooltip>
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <RechartsTooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <Legend />
          <Line type="monotone" dataKey="new_count" name="New" stroke="#22c55e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="lost_count" name="Lost" stroke="#ef4444" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="net" name="Net" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
