import { useState, useEffect, useCallback } from "react";
import {
  fetchReferringDomains,
  type ReferringDomain,
  type MatchMode,
  type LinksDrilldown,
} from "../../lib/api";
import { useSessionFilters } from "../../lib/useSessionFilters";
import { domainColumns } from "../../lib/columns";
import DataTable from "../tables/DataTable";
import ExportButton from "../tables/ExportButton";
import FilterInput from "../FilterInput";
import LoadingSpinner from "../LoadingSpinner";
import EmptyState from "../EmptyState";
import { FilterPanel, RangeFilter, SelectFilter } from "../filters";

interface DomainsTabProps {
  profile: string;
  onDrilldown: (d: LinksDrilldown) => void;
}

export default function DomainsTab({ profile, onDrilldown }: DomainsTabProps) {
  const [domains, setDomains] = useState<ReferringDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainInput, setDomainInput] = useState("");
  const [domainSearch, setDomainSearch] = useState<string | null>(null);
  const [domainMode, setDomainMode] = useState<MatchMode>("contains");
  const [domainExclude, setDomainExclude] = useState(false);
  const [drMin, setDrMin] = useState("");
  const [drMax, setDrMax] = useState("");
  const [trafficMin, setTrafficMin] = useState("");
  const [trafficMax, setTrafficMax] = useState("");
  const [linksMin, setLinksMin] = useState("");
  const [linksMax, setLinksMax] = useState("");
  const [sitewideFilter, setSitewideFilter] = useState("");

  const setDomainSearchCb = useCallback((v: string | null) => setDomainSearch(v), []);

  const clearFilters = useCallback(() => {
    setDomainInput(""); setDomainSearch(null); setDomainMode("contains"); setDomainExclude(false);
    setDrMin(""); setDrMax(""); setTrafficMin(""); setTrafficMax("");
    setLinksMin(""); setLinksMax(""); setSitewideFilter("");
  }, []);

  // Session filter persistence
  const getFilters = useCallback(() => ({
    domainInput, domainMode, domainExclude: String(domainExclude),
    drMin, drMax, trafficMin, trafficMax, linksMin, linksMax, sitewideFilter,
  }), [domainInput, domainMode, domainExclude, drMin, drMax, trafficMin, trafficMax, linksMin, linksMax, sitewideFilter]);

  const applyFilters = useCallback((f: Record<string, string>) => {
    if (f.domainInput) { setDomainInput(f.domainInput); setDomainSearch(f.domainInput); }
    if (f.domainMode) setDomainMode(f.domainMode as MatchMode);
    if (f.domainExclude) setDomainExclude(f.domainExclude === "true");
    if (f.drMin) setDrMin(f.drMin);
    if (f.drMax) setDrMax(f.drMax);
    if (f.trafficMin) setTrafficMin(f.trafficMin);
    if (f.trafficMax) setTrafficMax(f.trafficMax);
    if (f.linksMin) setLinksMin(f.linksMin);
    if (f.linksMax) setLinksMax(f.linksMax);
    if (f.sitewideFilter) setSitewideFilter(f.sitewideFilter);
  }, []);

  const { loaded: sessionLoaded, save: saveSession } = useSessionFilters(
    profile, "domains", getFilters, applyFilters,
  );

  useEffect(() => {
    if (!sessionLoaded) return;
    saveSession();
    setLoading(true);
    const params: Record<string, string | number | boolean | undefined> = {};
    if (domainSearch) {
      params.domain_search = domainSearch;
      if (domainMode !== "contains") params.domain_mode = domainMode;
      if (domainExclude) params.domain_exclude = true;
    }
    if (drMin) params.dr_min = parseFloat(drMin);
    if (drMax) params.dr_max = parseFloat(drMax);
    if (trafficMin) params.traffic_min = parseFloat(trafficMin);
    if (trafficMax) params.traffic_max = parseFloat(trafficMax);
    if (linksMin) params.links_min = parseInt(linksMin);
    if (linksMax) params.links_max = parseInt(linksMax);
    if (sitewideFilter) params.is_sitewide = sitewideFilter === "yes";
    fetchReferringDomains(profile, params)
      .then(setDomains)
      .catch(() => setDomains([]))
      .finally(() => setLoading(false));
  }, [profile, domainSearch, domainMode, domainExclude, drMin, drMax, trafficMin, trafficMax, linksMin, linksMax, sitewideFilter, sessionLoaded, saveSession]);

  const handleRowClick = (row: ReferringDomain) => {
    onDrilldown({ domain: row.referring_domain });
  };

  const activeCount = [domainSearch, drMin, drMax, trafficMin, trafficMax, linksMin, linksMax, sitewideFilter].filter(Boolean).length;

  return (
    <div>
      <FilterPanel activeCount={activeCount} onClear={clearFilters}>
        <div className="flex items-center gap-3 flex-wrap">
          <FilterInput
            value={domainInput}
            onChange={setDomainInput}
            placeholder="Filter by domain..."
            exclude={domainExclude}
            onExcludeChange={setDomainExclude}
            matchMode={domainMode}
            onMatchModeChange={setDomainMode}
            onDebouncedChange={setDomainSearchCb}
          />
          <RangeFilter label="DR" min={drMin} max={drMax} onMinChange={setDrMin} onMaxChange={setDrMax} />
          <RangeFilter label="Traffic" min={trafficMin} max={trafficMax} onMinChange={setTrafficMin} onMaxChange={setTrafficMax} inputWidth="w-20" />
          <RangeFilter label="Links" min={linksMin} max={linksMax} onMinChange={setLinksMin} onMaxChange={setLinksMax} />
          <SelectFilter
            value={sitewideFilter}
            onChange={setSitewideFilter}
            allLabel="Sitewide: All"
            options={[
              { value: "yes", label: "Sitewide: Yes" },
              { value: "no", label: "Sitewide: No" },
            ]}
          />
        </div>
      </FilterPanel>

      {loading ? (
        <LoadingSpinner message="Loading domains..." />
      ) : domains.length === 0 ? (
        <EmptyState title="No referring domains found" description="Try adjusting your filters." />
      ) : (
        <div className="bg-white rounded-lg shadow p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Referring Domains</h3>
            <p className="text-xs text-gray-400 mt-1">Click any row to see all backlinks from that domain.</p>
          </div>
          <DataTable data={domains} columns={domainColumns} onRowClick={handleRowClick} toolbar={<ExportButton data={domains as unknown as Record<string, unknown>[]} filename="referring-domains.csv" />} />
        </div>
      )}
    </div>
  );
}
