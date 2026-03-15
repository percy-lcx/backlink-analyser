interface FilterGroupProps {
  label: string;
  children: React.ReactNode;
}

export default function FilterGroup({ label, children }: FilterGroupProps) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-gray-400 uppercase mb-2">{label}</legend>
      <div className="flex items-center gap-3 flex-wrap">
        {children}
      </div>
    </fieldset>
  );
}
