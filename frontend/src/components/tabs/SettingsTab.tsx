import { useState, useEffect, useCallback } from "react";
import {
  fetchAnchorSettings,
  saveProfileAnchorSettings,
  saveGlobalAnchorSettings,
} from "../../lib/api";

interface SettingsTabProps {
  profile: string;
}

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

  const handleAdd = () => {
    const parts = input.split(/[,\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    for (const p of parts) onAdd(p);
    setInput("");
  };

  const sorted = [...terms].sort();

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
        <div className="border border-gray-200 rounded-md overflow-hidden mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary-50">
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Term</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600 w-24">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((term, idx) => (
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
      )}
    </div>
  );
}

export default function SettingsTab({ profile }: SettingsTabProps) {
  const [brandedTerms, setBrandedTerms] = useState<string[]>([]);
  const [targetKeywords, setTargetKeywords] = useState<string[]>([]);
  const [genericAnchors, setGenericAnchors] = useState<string[]>([]);
  const [autoBrandedTerms, setAutoBrandedTerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchAnchorSettings(profile)
      .then((data) => {
        setBrandedTerms(data.branded_terms);
        setTargetKeywords(data.target_keywords);
        setGenericAnchors(data.generic_anchors);
        setAutoBrandedTerms(data.auto_branded_terms);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const saveProfile = useCallback(
    (branded: string[], keywords: string[]) => {
      saveProfileAnchorSettings(profile, branded, keywords).catch(() => {});
    },
    [profile],
  );

  const saveGlobal = useCallback((generic: string[]) => {
    saveGlobalAnchorSettings(generic).catch(() => {});
  }, []);

  const addBranded = useCallback((term: string) => {
    setBrandedTerms((prev) => {
      if (prev.includes(term)) return prev;
      const next = [...prev, term];
      saveProfile(next, targetKeywords);
      return next;
    });
  }, [saveProfile, targetKeywords]);

  const removeBranded = useCallback((term: string) => {
    setBrandedTerms((prev) => {
      const next = prev.filter((t) => t !== term);
      saveProfile(next, targetKeywords);
      return next;
    });
  }, [saveProfile, targetKeywords]);

  const addKeyword = useCallback((term: string) => {
    setTargetKeywords((prev) => {
      if (prev.includes(term)) return prev;
      const next = [...prev, term];
      saveProfile(brandedTerms, next);
      return next;
    });
  }, [saveProfile, brandedTerms]);

  const removeKeyword = useCallback((term: string) => {
    setTargetKeywords((prev) => {
      const next = prev.filter((t) => t !== term);
      saveProfile(brandedTerms, next);
      return next;
    });
  }, [saveProfile, brandedTerms]);

  const addGeneric = useCallback((term: string) => {
    setGenericAnchors((prev) => {
      if (prev.includes(term)) return prev;
      const next = [...prev, term];
      saveGlobal(next);
      return next;
    });
  }, [saveGlobal]);

  const removeGeneric = useCallback((term: string) => {
    setGenericAnchors((prev) => {
      const next = prev.filter((t) => t !== term);
      saveGlobal(next);
      return next;
    });
  }, [saveGlobal]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading settings...</div>;
  }

  return (
    <div>
      <TermList
        title={`Branded Terms for "${profile}"`}
        description="Anchors containing these terms are categorized as branded. Auto-detected terms from your target domain are always included."
        terms={brandedTerms}
        onAdd={addBranded}
        onRemove={removeBranded}
        placeholder="e.g. my brand, mybrand..."
        autoTerms={autoBrandedTerms}
      />

      <TermList
        title={`Target Keywords for "${profile}"`}
        description="Anchors matching these keywords are categorized as exact match or partial match."
        terms={targetKeywords}
        onAdd={addKeyword}
        onRemove={removeKeyword}
        placeholder="e.g. forex trading, demo account..."
      />

      <TermList
        title="Generic Anchors"
        description="Anchors containing these terms are categorized as generic. This list applies to all profiles."
        terms={genericAnchors}
        onAdd={addGeneric}
        onRemove={removeGeneric}
        placeholder="e.g. click here, read more..."
      />
    </div>
  );
}
