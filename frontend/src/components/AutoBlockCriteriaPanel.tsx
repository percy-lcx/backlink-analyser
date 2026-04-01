import { useEffect, useState } from "react";
import {
  autoBlockCriteria,
  fetchBlocklistColumns,
  type AutoBlockCriteriaBody,
  type ColumnMetadata,
  type CriterionRule,
} from "../lib/api";

interface Props {
  onBlockComplete: () => void;
  profile?: string | null;
}

const NUMERIC_OPS = ["=", "!=", "<", "<=", ">", ">="] as const;
const STRING_OPS = ["contains", "not_contains", "=", "!="] as const;

const OP_LABELS: Record<string, string> = {
  "=": "=",
  "!=": "≠",
  "<": "<",
  "<=": "≤",
  ">": ">",
  ">=": "≥",
  contains: "contains",
  not_contains: "not contains",
};

function emptyRule(): CriterionRule {
  return { field: "", aggregation: null, operator: "=", value: "" };
}

function fieldType(field: string, cols: ColumnMetadata | null): "numeric" | "boolean" | "string" {
  if (cols?.numeric.includes(field)) return "numeric";
  if (cols?.boolean.includes(field)) return "boolean";
  return "string";
}

export default function AutoBlockCriteriaPanel({ onBlockComplete, profile }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [cols, setCols] = useState<ColumnMetadata | null>(null);
  const [rules, setRules] = useState<CriterionRule[]>([emptyRule()]);
  const [combine, setCombine] = useState<"AND" | "OR">("AND");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchBlocklistColumns().then(setCols).catch(() => {});
  }, []);

  const updateRule = (idx: number, patch: Partial<CriterionRule>) => {
    setRules((prev) => {
      const next = [...prev];
      const updated = { ...next[idx], ...patch };
      // Reset dependent fields when field changes
      if (patch.field !== undefined) {
        const type = fieldType(patch.field, cols);
        if (type === "numeric") {
          updated.aggregation = updated.aggregation && ["MAX", "MIN", "AVG"].includes(updated.aggregation) ? updated.aggregation : "MAX";
          if (!NUMERIC_OPS.includes(updated.operator as typeof NUMERIC_OPS[number])) updated.operator = "<=";
        } else if (type === "boolean") {
          updated.aggregation = updated.aggregation && ["ANY", "ALL"].includes(updated.aggregation) ? updated.aggregation : "ANY";
          updated.operator = "=";
          if (!["true", "false"].includes(updated.value)) updated.value = "true";
        } else {
          updated.aggregation = null;
          if (!STRING_OPS.includes(updated.operator as typeof STRING_OPS[number])) updated.operator = "contains";
        }
      }
      next[idx] = updated;
      return next;
    });
    setPreviewCount(null);
    setMessage(null);
  };

  const addRule = () => {
    setRules((prev) => [...prev, emptyRule()]);
    setPreviewCount(null);
  };

  const removeRule = (idx: number) => {
    setRules((prev) => prev.filter((_, i) => i !== idx));
    setPreviewCount(null);
  };

  const validRules = rules.filter((r) => r.field && r.value);

  const buildBody = (preview: boolean): AutoBlockCriteriaBody => ({
    combine,
    rules: validRules,
    preview,
  });

  const handlePreview = async () => {
    if (validRules.length === 0) return;
    setPreviewLoading(true);
    setMessage(null);
    try {
      const res = await autoBlockCriteria(buildBody(true), profile);
      setPreviewCount(res.matched);
    } catch {
      setMessage("Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleBlock = async () => {
    if (validRules.length === 0) return;
    setBlocking(true);
    setMessage(null);
    try {
      const res = await autoBlockCriteria(buildBody(false), profile);
      setMessage(
        res.added && res.added > 0
          ? `Added ${res.added} domain${res.added === 1 ? "" : "s"} (${res.total} total)`
          : "No new domains matched",
      );
      setPreviewCount(null);
      onBlockComplete();
    } catch {
      setMessage("Failed to block domains");
    } finally {
      setBlocking(false);
    }
  };

  const allFields = cols
    ? [
        { label: "Numeric", options: cols.numeric },
        { label: "Boolean", options: cols.boolean },
        { label: "String", options: cols.string },
      ]
    : [];

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <h3 className="text-sm font-semibold text-gray-700">Auto-Block Criteria</h3>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400 mb-4">
            Define rules to automatically find and blocklist matching referring domains.
          </p>

          {/* AND / OR toggle */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-500">Combine rules with:</span>
            {(["AND", "OR"] as const).map((mode) => (
              <button
                key={mode}
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  combine === mode
                    ? "bg-primary-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                onClick={() => { setCombine(mode); setPreviewCount(null); }}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Rules */}
          <div className="space-y-2 mb-4">
            {rules.map((rule, idx) => {
              const type = rule.field ? fieldType(rule.field, cols) : null;
              return (
                <div key={idx} className="flex items-center gap-2 flex-wrap">
                  {/* Field */}
                  <select
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white min-w-[160px]"
                    value={rule.field}
                    onChange={(e) => updateRule(idx, { field: e.target.value })}
                  >
                    <option value="">Select field...</option>
                    {allFields.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  {/* Aggregation (numeric / boolean only) */}
                  {type === "numeric" && (
                    <select
                      className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white w-20"
                      value={rule.aggregation || "MAX"}
                      onChange={(e) => updateRule(idx, { aggregation: e.target.value })}
                    >
                      <option value="MAX">MAX</option>
                      <option value="MIN">MIN</option>
                      <option value="AVG">AVG</option>
                    </select>
                  )}
                  {type === "boolean" && (
                    <select
                      className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white w-20"
                      value={rule.aggregation || "ANY"}
                      onChange={(e) => updateRule(idx, { aggregation: e.target.value })}
                    >
                      <option value="ANY">ANY</option>
                      <option value="ALL">ALL</option>
                    </select>
                  )}

                  {/* Operator */}
                  {type === "boolean" ? (
                    <span className="text-sm text-gray-500">=</span>
                  ) : (
                    <select
                      className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white w-28"
                      value={rule.operator}
                      onChange={(e) => updateRule(idx, { operator: e.target.value })}
                    >
                      {(type === "numeric" ? NUMERIC_OPS : STRING_OPS).map((op) => (
                        <option key={op} value={op}>
                          {OP_LABELS[op]}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Value */}
                  {type === "boolean" ? (
                    <select
                      className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white w-24"
                      value={rule.value || "true"}
                      onChange={(e) => updateRule(idx, { value: e.target.value })}
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      type={type === "numeric" ? "number" : "text"}
                      className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white w-32"
                      placeholder={type === "numeric" ? "0" : "value..."}
                      value={rule.value}
                      onChange={(e) => updateRule(idx, { value: e.target.value })}
                    />
                  )}

                  {/* Remove */}
                  <button
                    className="text-gray-400 hover:text-red-500 disabled:opacity-30"
                    onClick={() => removeRule(idx)}
                    disabled={rules.length <= 1}
                    title="Remove rule"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          <button
            className="text-xs text-primary-500 hover:text-primary-700 hover:underline mb-4"
            onClick={addRule}
          >
            + Add rule
          </button>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-2">
            <button
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 disabled:opacity-50"
              onClick={handlePreview}
              disabled={previewLoading || validRules.length === 0}
            >
              {previewLoading
                ? "Scanning..."
                : previewCount !== null
                  ? `Preview (${previewCount} domain${previewCount === 1 ? "" : "s"})`
                  : "Preview"}
            </button>
            <button
              className="px-3 py-1.5 bg-primary-500 text-white rounded-md text-xs font-medium hover:bg-primary-600 disabled:opacity-50"
              onClick={handleBlock}
              disabled={blocking || validRules.length === 0}
            >
              {blocking ? "Blocking..." : "Block matching domains"}
            </button>
            {message && <span className="text-xs text-gray-500">{message}</span>}
          </div>

        </div>
      )}
    </div>
  );
}
