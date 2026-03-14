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
import type { QualityPoint } from "../../lib/api";
import Tooltip from "../Tooltip";
import { METRICS } from "../../lib/metrics";

interface Props {
  data: QualityPoint[];
}

export default function ScatterPlot({ data }: Props) {
  const clean = data.filter((d) => !d.is_spam);
  const spam = data.filter((d) => d.is_spam);

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        <Tooltip text={METRICS.quality_matrix.short}>Quality Matrix (DR vs Traffic)</Tooltip>
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" dataKey="domain_rating" name="DR" tick={{ fontSize: 12 }} label={{ value: "Domain Rating", position: "insideBottom", offset: -5, fontSize: 12 }} />
          <YAxis type="number" dataKey="page_traffic" name="Traffic" tick={{ fontSize: 12 }} label={{ value: "Page Traffic", angle: -90, position: "insideLeft", fontSize: 12 }} />
          <RechartsTooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <Legend />
          <Scatter name="Clean" data={clean} fill="#6366f1" opacity={0.7} />
          <Scatter name="Spam" data={spam} fill="#ef4444" opacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
