import { useState, useEffect, useCallback } from "react";
import {
  fetchAllAnchorSettings,
  saveProfileAnchorSettings,
  saveGlobalAnchorSettings,
  type ProfileBrandedSettings,
} from "../../lib/api";

const PAGE_SIZE = 25;

interface TermListProps {
  title: string;
  description: string;
  terms: string[];
  onAdd: (term: string) => void;
  onRemove: (term: string) => void;
  placeholder?: string;
  autoTerms?: string[];
}

function TermList({ title, description, terms, onAdd, onRemove, placeholder, autoTerms }: TermListProps) {
  const [input, setInput] = useState("");
  const [page, setPage] = useState(0);

  const handleAdd = () => {
    const parts = input.split(/[,\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    for (const p of parts) onAdd(p);
    setInput("");
  };

  const sorted = [...terms].sort();
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const showPagination = sorted.length > PAGE_SIZE;

  // Reset page when terms change significantly
  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  return (
    <div className="bg-white rounded-lg shadow p-5 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
      <p className="text-xs text-gray-400 mb-4">{description}</p>

      {autoTerms && autoTerms.length > 0 && (
        <div className="mb-4">
          <span className="text-xs text-gray-500 font-medium">Auto-detected from domain:</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {autoTerms.map((t) => (
              <span key={t} className="bg-gray-100 text-gray-500 border border-gray-200 rounded-full px-3 py-1 text-xs">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder={placeholder ?? "Enter term(s), comma-separated..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
        />
        <button
          className="px-4 py-2 bg-primary-500 text-white rounded-md text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
          onClick={handleAdd}
          disabled={!input.trim()}
        >
          Add
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">No terms added yet.</p>
      ) : (
        <>
          <div className="border border-gray-200 rounded-md overflow-hidden mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Term</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600 w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((term, idx) => (
                  <tr key={term} className={`border-b border-gray-100 ${idx % 2 === 1 ? "bg-row-alt" : ""}`}>
                    <td className="px-3 py-2 font-mono text-gray-800">{term}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                        onClick={() => onRemove(term)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showPagination && (
            <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
              <span>{sorted.length} terms total</span>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                >
                  Previous
                </button>
                <span>
                  Page {safePage + 1} of {totalPages}
                </span>
                <button
                  className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SettingsTab() {
  const [profileSettings, setProfileSettings] = useState<Record<string, ProfileBrandedSettings>>({});
  const [targetKeywords, setTargetKeywords] = useState<string[]>([]);
  const [genericAnchors, setGenericAnchors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchAllAnchorSettings()
      .then((data) => {
        setProfileSettings(data.profiles);
        setTargetKeywords(data.target_keywords);
        setGenericAnchors(data.generic_anchors);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveGlobal = useCallback((keywords: string[], generic: string[]) => {
    saveGlobalAnchorSettings(generic, keywords).catch(() => {});
  }, []);

  // --- Branded terms handlers (per-profile) ---
  const addBranded = useCallback((profileLabel: string, term: string) => {
    setProfileSettings((prev) => {
      const current = prev[profileLabel];
      if (!current || current.branded_terms.includes(term)) return prev;
      const next = { ...current, branded_terms: [...current.branded_terms, term] };
      saveProfileAnchorSettings(profileLabel, next.branded_terms).catch(() => {});
      return { ...prev, [profileLabel]: next };
    });
  }, []);

  const removeBranded = useCallback((profileLabel: string, term: string) => {
    setProfileSettings((prev) => {
      const current = prev[profileLabel];
      if (!current) return prev;
      const next = { ...current, branded_terms: current.branded_terms.filter((t) => t !== term) };
      saveProfileAnchorSettings(profileLabel, next.branded_terms).catch(() => {});
      return { ...prev, [profileLabel]: next };
    });
  }, []);

  // --- Target keywords handlers (global) ---
  const addKeyword = useCallback((term: string) => {
    setTargetKeywords((prev) => {
      if (prev.includes(term)) return prev;
      const next = [...prev, term];
      saveGlobal(next, genericAnchors);
      return next;
    });
  }, [saveGlobal, genericAnchors]);

  const removeKeyword = useCallback((term: string) => {
    setTargetKeywords((prev) => {
      const next = prev.filter((t) => t !== term);
      saveGlobal(next, genericAnchors);
      return next;
    });
  }, [saveGlobal, genericAnchors]);

  // --- Generic anchors handlers (global) ---
  const addGeneric = useCallback((term: string) => {
    setGenericAnchors((prev) => {
      if (prev.includes(term)) return prev;
      const next = [...prev, term];
      saveGlobal(targetKeywords, next);
      return next;
    });
  }, [saveGlobal, targetKeywords]);

  const removeGeneric = useCallback((term: string) => {
    setGenericAnchors((prev) => {
      const next = prev.filter((t) => t !== term);
      saveGlobal(targetKeywords, next);
      return next;
    });
  }, [saveGlobal, targetKeywords]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading settings...</div>;
  }

  const profileLabels = Object.keys(profileSettings).sort();

  return (
    <div>
      {/* Branded terms — one panel per profile */}
      {profileLabels.map((label) => (
        <TermList
          key={label}
          title={`Branded Terms — ${label}`}
          description="Anchors containing these terms are categorized as branded. Auto-detected terms from the target domain are always included."
          terms={profileSettings[label].branded_terms}
          onAdd={(term) => addBranded(label, term)}
          onRemove={(term) => removeBranded(label, term)}
          placeholder="e.g. my brand, mybrand..."
          autoTerms={profileSettings[label].auto_branded_terms}
        />
      ))}

      {/* Global target keywords */}
      <TermList
        title="Target Keywords"
        description="Anchors matching these keywords are categorized as exact match or partial match. Applies to all profiles."
        terms={targetKeywords}
        onAdd={addKeyword}
        onRemove={removeKeyword}
        placeholder="e.g. forex trading, demo account..."
      />

      {/* Global generic anchors */}
      <TermList
        title="Generic Anchors"
        description="Anchors containing these terms are categorized as generic. Applies to all profiles."
        terms={genericAnchors}
        onAdd={addGeneric}
        onRemove={removeGeneric}
        placeholder="e.g. click here, read more..."
      />
    </div>
  );
}
