interface RangeFilterProps {
  label: string;
  min: string;
  max: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  inputWidth?: string;
}

export default function RangeFilter({ label, min, max, onMinChange, onMaxChange, inputWidth = "w-16" }: RangeFilterProps) {
  const inputCls = `${inputWidth} border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500`;
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <input type="number" placeholder="Min" value={min} onChange={(e) => onMinChange(e.target.value)} className={inputCls} />
      <span className="text-gray-400">&ndash;</span>
      <input type="number" placeholder="Max" value={max} onChange={(e) => onMaxChange(e.target.value)} className={inputCls} />
    </div>
  );
}
