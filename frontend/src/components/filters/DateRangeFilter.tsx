interface DateRangeFilterProps {
  label: string;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}

export default function DateRangeFilter({ label, from, to, onFromChange, onToChange }: DateRangeFilterProps) {
  const inputCls = "border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500";
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className={inputCls} />
      <span className="text-gray-400">&ndash;</span>
      <input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className={inputCls} />
    </div>
  );
}
