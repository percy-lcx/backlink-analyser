import { useRef, useEffect } from "react";
import type { MatchMode } from "../lib/api";

interface FilterInputProps {
  /** Current text value */
  value: string;
  onChange: (value: string) => void;
  /** Placeholder when in include mode */
  placeholder: string;
  /** Placeholder when in exclude mode (auto-generated if omitted) */
  excludePlaceholder?: string;
  /** Whether the filter excludes matches */
  exclude?: boolean;
  onExcludeChange?: (exclude: boolean) => void;
  /** Current match mode */
  matchMode?: MatchMode;
  onMatchModeChange?: (mode: MatchMode) => void;
  /** Debounce delay in ms (default 300) */
  debounceMs?: number;
  /** Called with debounced value */
  onDebouncedChange: (value: string | null) => void;
}

const MODE_LABELS: Record<MatchMode, string> = {
  contains: "Contains",
  exact: "Exact",
  regex: "Regex",
};

const MODE_ICONS: Record<MatchMode, string> = {
  contains: "≈",
  exact: "=",
  regex: ".*",
};

export default function FilterInput({
  value,
  onChange,
  placeholder,
  excludePlaceholder,
  exclude = false,
  onExcludeChange,
  matchMode = "contains",
  onMatchModeChange,
  debounceMs = 300,
  onDebouncedChange,
}: FilterInputProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce input changes
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onDebouncedChange(value || null);
    }, debounceMs);
    return () => clearTimeout(debounceRef.current);
  }, [value, debounceMs, onDebouncedChange]);

  const cycleMode = () => {
    if (!onMatchModeChange) return;
    const modes: MatchMode[] = ["contains", "exact", "regex"];
    const next = modes[(modes.indexOf(matchMode) + 1) % modes.length];
    onMatchModeChange(next);
  };

  const resolvedPlaceholder = exclude
    ? excludePlaceholder || placeholder.replace(/^Filter by/, "Exclude")
    : placeholder;

  return (
    <div className="flex min-w-[180px] max-w-xs flex-1">
      {/* Include / Exclude toggle */}
      {onExcludeChange && (
        <button
          onClick={() => onExcludeChange(!exclude)}
          className={`px-2 py-2 text-sm font-medium border rounded-l-md transition-colors shrink-0 ${
            exclude
              ? "bg-red-600 text-white border-red-600"
              : "bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100"
          }`}
          title={exclude ? "Excluding — click to include" : "Including — click to exclude"}
        >
          {exclude ? "\u2212" : "+"}
        </button>
      )}

      {/* Text input */}
      <div className="relative flex-1">
        <input
          type="text"
          placeholder={resolvedPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
            onExcludeChange ? "border-l-0" : "rounded-l-md"
          } ${onMatchModeChange ? "" : "rounded-r-md"} ${
            exclude ? "border-red-300" : "border-gray-300"
          }`}
        />
        {value && (
          <button
            onClick={() => {
              onChange("");
              onDebouncedChange(null);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
          >
            &#x2715;
          </button>
        )}
      </div>

      {/* Match mode toggle */}
      {onMatchModeChange && (
        <button
          onClick={cycleMode}
          className={`px-2 py-2 text-xs font-medium border border-l-0 rounded-r-md transition-colors shrink-0 ${
            matchMode === "contains"
              ? "bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100"
              : matchMode === "exact"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-amber-500 text-white border-amber-500"
          }`}
          title={`${MODE_LABELS[matchMode]} match — click to cycle`}
        >
          {MODE_ICONS[matchMode]}
        </button>
      )}
    </div>
  );
}
