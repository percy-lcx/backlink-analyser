import { useState } from "react";
import { useBlocklist } from "../BlocklistContext";

export default function BlocklistTab() {
  const { blocklist, add, addMany, remove } = useBlocklist();
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const parts = input.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    if (parts.length === 1) add(parts[0]);
    else addMany(parts);
    setInput("");
  };

  const sorted = [...blocklist].sort();

  return (
    <div>
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Domain Blocklist</h3>
        <p className="text-xs text-gray-400 mb-4">
          Domains added here will be visually flagged in all tables. They are not excluded from results.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Enter domain(s), comma-separated..."
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
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Blocklisted Domains ({sorted.length})
          </h3>
        </div>

        {sorted.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            No domains blocklisted yet. Add domains above to flag them in your tables.
          </p>
        ) : (
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Domain</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600 w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((domain, idx) => (
                  <tr
                    key={domain}
                    className={`border-b border-gray-100 ${idx % 2 === 1 ? "bg-row-alt" : ""}`}
                  >
                    <td className="px-3 py-2 font-mono text-gray-800">{domain}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                        onClick={() => remove(domain)}
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
    </div>
  );
}
