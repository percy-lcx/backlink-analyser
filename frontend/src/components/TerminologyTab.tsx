import { METRICS, type MetricDef } from "../lib/metrics";

const CATEGORY_ORDER = ["Overview", "Links", "Domains", "Anchors", "Pages", "Quality", "Compare", "Charts"];

export default function TerminologyTab() {
  const grouped = Object.values(METRICS).reduce<Record<string, MetricDef[]>>((acc, m) => {
    (acc[m.category] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {CATEGORY_ORDER.filter((c) => grouped[c]).map((category) => (
        <div key={category} className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{category}</h3>
          <dl className="space-y-4">
            {grouped[category].map((m) => (
              <div key={m.label}>
                <dt className="text-sm font-medium text-gray-800">{m.label}</dt>
                <dd className="text-sm text-gray-500 mt-0.5">{m.full}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
