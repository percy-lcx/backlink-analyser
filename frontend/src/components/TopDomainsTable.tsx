import type { ReferringDomain } from "../lib/api";

interface Props {
  domains: ReferringDomain[];
  onViewAll?: () => void;
}

export default function TopDomainsTable({ domains, onViewAll }: Props) {
  const top = domains.slice(0, 5);
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Top Referring Domains</h3>
        {onViewAll && (
          <button onClick={onViewAll} className="text-xs text-primary-500 hover:text-primary-700 font-medium">
            View all &rarr;
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
            <th className="pb-2 font-medium">Domain</th>
            <th className="pb-2 font-medium text-right">Links</th>
            <th className="pb-2 font-medium text-right">DR</th>
            <th className="pb-2 font-medium text-right">Traffic</th>
          </tr>
        </thead>
        <tbody>
          {top.map((d, i) => (
            <tr key={d.referring_domain} className={`border-b border-gray-50 last:border-0 ${i % 2 === 1 ? "bg-row-alt" : ""}`}>
              <td className="py-2 text-gray-800 truncate max-w-[200px]" title={d.referring_domain}>
                {d.referring_domain}
              </td>
              <td className="py-2 text-right text-gray-600">{d.link_count.toLocaleString()}</td>
              <td className="py-2 text-right font-medium text-gray-800">{d.max_dr}</td>
              <td className="py-2 text-right text-gray-600">{d.total_traffic.toLocaleString()}</td>
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
