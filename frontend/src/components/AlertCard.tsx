import Tooltip from "./Tooltip";

type AlertStatus = "ok" | "warning" | "danger";

interface AlertCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  status: AlertStatus;
  tooltip?: string;
  onClick?: () => void;
}

const STATUS_STYLES: Record<AlertStatus, { border: string; bg: string; text: string }> = {
  ok: { border: "border-l-green-500", bg: "bg-green-50", text: "text-green-700" },
  warning: { border: "border-l-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
  danger: { border: "border-l-red-500", bg: "bg-red-50", text: "text-red-700" },
};

export default function AlertCard({ label, value, subtitle, status, tooltip, onClick }: AlertCardProps) {
  const s = STATUS_STYLES[status];
  const labelEl = <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">{label}</span>;
  return (
    <div
      className={`rounded-lg shadow p-4 flex flex-col gap-1 border-l-4 ${s.border} ${s.bg} ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      {tooltip ? <Tooltip text={tooltip}>{labelEl}</Tooltip> : labelEl}
      <span className={`text-xl font-bold ${s.text}`}>{value}</span>
      {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
    </div>
  );
}
