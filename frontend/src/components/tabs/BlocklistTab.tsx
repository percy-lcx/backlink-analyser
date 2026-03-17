import { useState } from "react";
import { useBlocklist } from "../BlocklistContext";
import { useProfile } from "../ProfileContext";
import { autoBlockZeroTraffic } from "../../lib/api";

export default function BlocklistTab() {
  const { blocklist, add, addMany, remove, clear, refresh } = useBlocklist();
  const { selected } = useProfile();
  const [input, setInput] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blockMsg, setBlockMsg] = useState<string | null>(null);

  const handleAdd = () => {
    const parts = input.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    if (parts.length === 1) add(parts[0]);
    else addMany(parts);
    setInput("");
  };

  const handleAutoBlock = async () => {
    if (!selected) return;
    setBlocking(true);
    setBlockMsg(null);
    try {
      const res = await autoBlockZeroTraffic(selected);
      setBlockMsg(res.added > 0 ? `Added ${res.added} domain${res.added === 1 ? "" : "s"} (${res.total} total)` : "No new zero-traffic domains found");
      refresh();
    } catch {
      setBlockMsg("Failed to fetch zero-traffic domains");
    } finally {
      setBlocking(false);
    }
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
        <div className="flex items-center gap-3 mt-3">
          <button
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 disabled:opacity-50"
            onClick={handleAutoBlock}
            disabled={blocking || !selected}
          >
            {blocking ? "Scanning..." : "Block zero-traffic domains"}
          </button>
          {blockMsg && <span className="text-xs text-gray-500">{blockMsg}</span>}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Blocklisted Domains ({sorted.length})
          </h3>
          {sorted.length > 0 && (
            <div className="flex items-center gap-2">
              {confirming ? (
                <>
                  <span className="text-xs text-gray-500">Are you sure?</span>
                  <button
                    className="px-2 py-1 text-xs text-white bg-red-500 rounded hover:bg-red-600"
                    onClick={() => { clear(); setConfirming(false); }}
                  >
                    Yes, remove all
                  </button>
                  <button
                    className="px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                    onClick={() => setConfirming(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="text-xs text-red-500 hover:text-red-700 hover:underline"
                  onClick={() => setConfirming(true)}
                >
                  Remove all
                </button>
              )}
            </div>
          )}
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
