import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useBlocklist } from "../BlocklistContext";
import AutoBlockCriteriaPanel from "../AutoBlockCriteriaPanel";
import DataTable from "../tables/DataTable";

interface BlocklistRow {
  domain: string;
}

export default function BlocklistTab() {
  const { blocklist, add, addMany, remove, clear, refresh } = useBlocklist();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState(false);

  const handleAdd = () => {
    const parts = input.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    if (parts.length === 1) add(parts[0]);
    else addMany(parts);
    setInput("");
  };

  const sorted = useMemo<BlocklistRow[]>(
    () => [...blocklist].sort().map((d) => ({ domain: d })),
    [blocklist],
  );

  const filtered = useMemo(
    () => (search ? sorted.filter((r) => r.domain.includes(search.toLowerCase())) : sorted),
    [sorted, search],
  );

  const columns = useMemo<ColumnDef<BlocklistRow, unknown>[]>(
    () => [
      {
        accessorKey: "domain",
        header: "Domain",
        cell: ({ getValue }) => (
          <span className="font-mono">{getValue() as string}</span>
        ),
      },
      {
        id: "actions",
        header: "Action",
        size: 80,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => (
          <button
            className="text-xs text-red-500 hover:text-red-700 hover:underline"
            onClick={() => remove(row.original.domain)}
          >
            Remove
          </button>
        ),
      },
    ],
    [remove],
  );

  const toolbar = (
    <div className="flex items-center gap-2">
      {sorted.length > 0 && (
        <>
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
        </>
      )}
    </div>
  );

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

      <AutoBlockCriteriaPanel onBlockComplete={refresh} />

      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Blocklisted Domains ({sorted.length})
          </h3>
          <input
            type="text"
            className="ml-4 border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-64"
            placeholder="Search domains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <DataTable
          data={filtered}
          columns={columns}
          pageSize={100}
          toolbar={toolbar}
          statusText={
            search && filtered.length !== sorted.length ? (
              <span className="text-xs text-gray-500">
                {filtered.length.toLocaleString()} of {sorted.length.toLocaleString()} domains
              </span>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
