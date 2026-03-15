import type { PageRow } from "../lib/api";

interface Props {
  pages: PageRow[];
  onViewAll?: () => void;
}

export default function TopPagesTable({ pages, onViewAll }: Props) {
  const top = [...pages].sort((a, b) => b.link_count - a.link_count).slice(0, 5);
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Top Pages</h3>
        {onViewAll && (
          <button onClick={onViewAll} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            View all &rarr;
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
            <th className="pb-2 font-medium">Path</th>
            <th className="pb-2 font-medium text-right">Links</th>
            <th className="pb-2 font-medium text-right">Domains</th>
            <th className="pb-2 font-medium text-right">Avg DR</th>
          </tr>
        </thead>
        <tbody>
          {top.map((p) => (
            <tr key={p.target_path} className="border-b border-gray-50 last:border-0">
              <td className="py-2 text-gray-800 truncate max-w-[200px]" title={p.target_path}>
                {p.target_path}
              </td>
              <td className="py-2 text-right text-gray-600">{p.link_count.toLocaleString()}</td>
              <td className="py-2 text-right text-gray-600">{p.unique_referring_domains.toLocaleString()}</td>
              <td className="py-2 text-right font-medium text-gray-800">{p.avg_dr?.toFixed(1) ?? "—"}</td>
            </tr>
          ))}
          {top.length === 0 && (
            <tr><td colSpan={4} className="py-4 text-center text-gray-400">No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
