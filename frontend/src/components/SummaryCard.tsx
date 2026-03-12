interface SummaryCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export default function SummaryCard({ label, value, subtitle, color }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-5 flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${color ?? "text-gray-900"}`}>{value}</span>
      {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
    </div>
  );
}
