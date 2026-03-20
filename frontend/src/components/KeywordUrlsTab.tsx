import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useProfile } from "./ProfileContext";
import DataTable, { type SortingState } from "./tables/DataTable";
import ExportButton from "./tables/ExportButton";
import {
  fetchKeywordSuggestions,
  fetchKeywordRankingUrls,
  fetchKeywordCountries,
  type KeywordSuggestion,
  type KeywordBacklinkItem,
  type KeywordMatchMode,
  type RankingUrl,
  type KeywordRankingUrlsResponse,
} from "../lib/api";
import type { ColumnDef } from "@tanstack/react-table";

/** Map of common country codes to full names. */
const COUNTRY_NAMES: Record<string, string> = {
  us: "United States",
  gb: "United Kingdom",
  de: "Germany",
  fr: "France",
  au: "Australia",
  ca: "Canada",
  in: "India",
  br: "Brazil",
  es: "Spain",
  it: "Italy",
  nl: "Netherlands",
  se: "Sweden",
  no: "Norway",
  dk: "Denmark",
  fi: "Finland",
  pl: "Poland",
  pt: "Portugal",
  be: "Belgium",
  at: "Austria",
  ch: "Switzerland",
  ie: "Ireland",
  nz: "New Zealand",
  sg: "Singapore",
  hk: "Hong Kong",
  jp: "Japan",
  kr: "South Korea",
  cn: "China",
  tw: "Taiwan",
  th: "Thailand",
  ph: "Philippines",
  id: "Indonesia",
  my: "Malaysia",
  vn: "Vietnam",
  mx: "Mexico",
  ar: "Argentina",
  co: "Colombia",
  cl: "Chile",
  za: "South Africa",
  ng: "Nigeria",
  ke: "Kenya",
  eg: "Egypt",
  il: "Israel",
  ae: "United Arab Emirates",
  sa: "Saudi Arabia",
  tr: "Turkey",
  ru: "Russia",
  ua: "Ukraine",
  cz: "Czech Republic",
  ro: "Romania",
  hu: "Hungary",
  gr: "Greece",
  hr: "Croatia",
  bg: "Bulgaria",
  sk: "Slovakia",
  lt: "Lithuania",
  lv: "Latvia",
  ee: "Estonia",
  si: "Slovenia",
};

/** Countries pinned to the top of the dropdown, in order. */
const PRIORITY_COUNTRIES = ["us", "gb", "de", "fr", "au"];

function countryLabel(code: string): string {
  return COUNTRY_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

interface KeywordUrlsTabProps {
  profile: string;
}

export default function KeywordUrlsTab({ profile }: KeywordUrlsTabProps) {
  const { profiles } = useProfile();

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [activeKeyword, setActiveKeyword] = useState("");
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filters
  const [matchMode, setMatchMode] = useState<KeywordMatchMode>("contains");
  const [minPosition, setMinPosition] = useState(1);
  const [maxPosition, setMaxPosition] = useState(100);
  const [minDr, setMinDr] = useState<number | undefined>(undefined);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([profile]);
  const [countries, setCountries] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("");

  // Data state
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<KeywordRankingUrlsResponse | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [sortStr, setSortStr] = useState("domain_rating:desc");

  // Update selected profiles when active profile changes
  useEffect(() => {
    setSelectedProfiles((prev) =>
      prev.includes(profile) ? prev : [profile, ...prev],
    );
  }, [profile]);

  // Fetch available countries
  useEffect(() => {
    fetchKeywordCountries().then(setCountries).catch(() => {});
  }, []);

  // Debounced suggestions
  useEffect(() => {
    if (searchInput.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      const controller = new AbortController();
      fetchKeywordSuggestions(searchInput, controller.signal, matchMode)
        .then(setSuggestions)
        .catch(() => {});
      return () => controller.abort();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, matchMode]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch data when keyword/filters/pagination change
  useEffect(() => {
    if (!activeKeyword) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetchKeywordRankingUrls(
      {
        keyword: activeKeyword,
        match: matchMode,
        min_position: minPosition,
        max_position: maxPosition,
        min_dr: minDr,
        profiles: selectedProfiles.length > 0 ? selectedProfiles.join(",") : undefined,
        country: selectedCountry || undefined,
        page,
        per_page: perPage,
        sort: sortStr,
      },
      controller.signal,
    )
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [activeKeyword, matchMode, minPosition, maxPosition, minDr, selectedProfiles, selectedCountry, page, perPage, sortStr]);

  const handleSearch = useCallback(() => {
    const q = searchInput.trim();
    if (!q) return;
    setActiveKeyword(q);
    setPage(1);
    setSelectedUrl(null);
    setShowSuggestions(false);
  }, [searchInput]);

  const handleSuggestionClick = useCallback((kw: string) => {
    setSearchInput(kw);
    setActiveKeyword(kw);
    setPage(1);
    setSelectedUrl(null);
    setShowSuggestions(false);
  }, []);

  const handleSortChange = useCallback((sorting: SortingState) => {
    if (sorting.length === 0) {
      setSortStr("domain_rating:desc");
    } else {
      const s = sorting[0];
      setSortStr(`${s.id}:${s.desc ? "desc" : "asc"}`);
    }
    setPage(1);
  }, []);

  // Ranking URLs with backlink counts
  const rankingUrlsWithCounts = useMemo(() => {
    if (!data) return [];
    // Deduplicate ranking URLs (same URL+country can appear for multiple keywords)
    const urlMap = new Map<string, RankingUrl & { backlink_count: number }>();
    for (const ru of data.ranking_urls) {
      const key = `${ru.url}::${ru.country_code}`;
      if (!urlMap.has(key)) {
        urlMap.set(key, { ...ru, backlink_count: 0 });
      }
    }
    // Count backlinks per target URL from current page (approximate — total is server-side)
    for (const item of data.items) {
      const entry = urlMap.get(item.target_url);
      if (entry) entry.backlink_count++;
    }
    return Array.from(urlMap.values()).sort((a, b) => a.position - b.position);
  }, [data]);

  // Filter backlinks by selected URL
  const filteredItems = useMemo(() => {
    if (!data) return [];
    if (!selectedUrl) return data.items;
    return data.items.filter((item) => item.target_url === selectedUrl);
  }, [data, selectedUrl]);

  // Ranking URLs table columns
  const rankingColumns = useMemo((): ColumnDef<RankingUrl & { backlink_count: number }, unknown>[] => [
    {
      accessorKey: "url",
      header: "Ranking URL",
      size: 360,
      cell: ({ getValue }) => {
        const url = getValue() as string;
        return (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-primary-600 hover:underline break-all"
            title={url}
          >{url}</a>
        );
      },
    },
    {
      accessorKey: "keyword",
      header: "Keyword",
      size: 180,
    },
    {
      accessorKey: "position",
      header: "Position",
      size: 80,
      cell: ({ getValue }) => {
        const pos = getValue() as number;
        return (
          <span className={`font-mono text-sm ${pos <= 3 ? "text-emerald-600 font-bold" : pos <= 10 ? "text-primary-600" : "text-gray-600"}`}>
            {pos}
          </span>
        );
      },
    },
    {
      accessorKey: "volume",
      header: "Volume",
      size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v != null ? v.toLocaleString() : "-";
      },
    },
    {
      accessorKey: "traffic",
      header: "Traffic",
      size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v != null ? v.toLocaleString() : "-";
      },
    },
    {
      accessorKey: "country_code",
      header: "Country",
      size: 140,
      cell: ({ getValue }) => {
        const c = getValue() as string;
        return c ? countryLabel(c) : "-";
      },
    },
    {
      accessorKey: "profile_label",
      header: "Profile",
      size: 120,
    },
  ], []);

  // Backlinks table columns
  const backlinkColumns = useMemo((): ColumnDef<KeywordBacklinkItem, unknown>[] => [
    {
      accessorKey: "referring_domain",
      header: "Referring Domain",
      size: 200,
    },
    {
      accessorKey: "referring_url",
      header: "Referring Page",
      size: 300,
      cell: ({ getValue }) => {
        const url = getValue() as string;
        return (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-primary-600 hover:underline break-all"
            title={url}
          >{url}</a>
        );
      },
    },
    {
      accessorKey: "target_url",
      header: "Target URL",
      size: 260,
      cell: ({ getValue }) => {
        const url = getValue() as string;
        return (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-primary-600 hover:underline truncate block max-w-[240px]"
            title={url}
          >{url}</a>
        );
      },
    },
    {
      accessorKey: "domain_rating",
      header: "DR",
      size: 60,
    },
    {
      accessorKey: "anchor",
      header: "Anchor",
      size: 180,
    },
    {
      accessorKey: "link_type",
      header: "Type",
      size: 70,
    },
    {
      accessorKey: "page_traffic",
      header: "Page Traffic",
      size: 100,
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v != null ? v.toLocaleString() : "-";
      },
    },
    {
      accessorKey: "keyword",
      header: "Keyword",
      size: 160,
    },
    {
      accessorKey: "current_position",
      header: "Position",
      size: 80,
    },
    {
      accessorKey: "first_seen",
      header: "First Seen",
      size: 100,
    },
  ], []);

  // Summary stats
  const totalRankingUrls = rankingUrlsWithCounts.length;
  const totalBacklinks = data?.total ?? 0;
  const avgPosition = rankingUrlsWithCounts.length > 0
    ? Math.round(rankingUrlsWithCounts.reduce((s, r) => s + r.position, 0) / rankingUrlsWithCounts.length)
    : 0;
  const uniqueDomains = useMemo(() => {
    if (!data) return 0;
    return new Set(data.items.map((i) => i.referring_domain)).size;
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Search bar and filters */}
      <div className="flex items-start gap-6 flex-wrap">
        {/* Keyword search */}
        <div className="relative" ref={suggestionsRef}>
          <div className="flex items-center gap-2 mb-1">
            <label className="text-xs font-medium text-gray-500">Keyword</label>
            <div className="flex rounded-md border border-gray-300 overflow-hidden text-xs">
              <button
                className={`px-2 py-0.5 transition-colors ${matchMode === "contains" ? "bg-primary-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                onClick={() => { setMatchMode("contains"); setPage(1); }}
              >
                Contains
              </button>
              <button
                className={`px-2 py-0.5 transition-colors border-l border-gray-300 ${matchMode === "exact" ? "bg-primary-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                onClick={() => { setMatchMode("exact"); setPage(1); }}
              >
                Exact
              </button>
            </div>
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
          >
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              placeholder={matchMode === "exact" ? "e.g. forex trading" : "e.g. forex"}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5 w-72 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
            <button
              type="submit"
              className="text-sm text-white bg-primary-500 hover:bg-primary-600 px-4 py-1.5 rounded-md"
            >
              Search
            </button>
          </form>
          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 mt-1 w-72 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.keyword}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 flex items-center justify-between"
                  onClick={() => handleSuggestionClick(s.keyword)}
                >
                  <span className="truncate">{s.keyword}</span>
                  <span className="text-xs text-gray-400 ml-2 shrink-0">
                    vol: {s.volume?.toLocaleString() ?? "-"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Position range */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Position Range</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white w-20"
              value={minPosition}
              onChange={(e) => { setMinPosition(Number(e.target.value) || 1); setPage(1); }}
              min={1}
            />
            <span className="text-gray-400 text-sm">-</span>
            <input
              type="number"
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white w-20"
              value={maxPosition}
              onChange={(e) => { setMaxPosition(Number(e.target.value) || 100); setPage(1); }}
              min={1}
            />
          </div>
        </div>

        {/* Min DR */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Min DR</label>
          <input
            type="number"
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white w-20"
            placeholder="0"
            value={minDr ?? ""}
            onChange={(e) => { setMinDr(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
            min={0}
            max={100}
          />
        </div>

        {/* Country filter */}
        {countries.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
            <select
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white w-48"
              value={selectedCountry}
              onChange={(e) => { setSelectedCountry(e.target.value); setPage(1); }}
            >
              <option value="">All</option>
              {(() => {
                const priority = PRIORITY_COUNTRIES.filter((c) => countries.includes(c));
                const rest = countries
                  .filter((c) => !PRIORITY_COUNTRIES.includes(c))
                  .sort((a, b) => countryLabel(a).localeCompare(countryLabel(b)));
                const items: React.ReactNode[] = priority.map((c) => (
                  <option key={c} value={c}>{countryLabel(c)}</option>
                ));
                if (priority.length > 0 && rest.length > 0) {
                  items.push(<option key="__sep" disabled>──────────</option>);
                }
                rest.forEach((c) => {
                  items.push(<option key={c} value={c}>{countryLabel(c)}</option>);
                });
                return items;
              })()}
            </select>
          </div>
        )}

        {/* Profile scope */}
        {profiles.length > 1 && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs font-medium text-gray-500">Profiles</label>
              <button
                className="text-xs text-primary-500 hover:text-primary-700"
                onClick={() =>
                  setSelectedProfiles(
                    selectedProfiles.length === profiles.length
                      ? []
                      : profiles.map((p) => p.profile_label),
                  )
                }
              >
                {selectedProfiles.length === profiles.length ? "Clear" : "Select all"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {profiles.map((p) => (
                <label
                  key={p.profile_label}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm cursor-pointer transition-colors ${
                    selectedProfiles.includes(p.profile_label)
                      ? "border-primary-400 bg-primary-50 text-primary-700"
                      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selectedProfiles.includes(p.profile_label)}
                    onChange={() =>
                      setSelectedProfiles((prev) =>
                        prev.includes(p.profile_label)
                          ? prev.filter((x) => x !== p.profile_label)
                          : [...prev, p.profile_label],
                      )
                    }
                  />
                  {p.profile_label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <p className="text-sm text-gray-500">Searching keywords and backlinks...</p>
      )}

      {!loading && !activeKeyword && (
        <div className="text-center text-gray-400 py-16">
          <p className="text-lg font-medium">Enter a keyword to find ranking URLs and their backlinks</p>
          <p className="text-sm mt-2">
            The tool will find URLs ranking for that keyword across your profiles,
            then show all backlinks pointing to those URLs.
          </p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">Ranking URLs</p>
              <p className="text-2xl font-bold text-gray-900">{totalRankingUrls.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">URLs ranking for "{data.keyword_query}"</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">Total Backlinks</p>
              <p className="text-2xl font-bold text-primary-600">{totalBacklinks.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">Pointing to ranking URLs</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">Avg Position</p>
              <p className="text-2xl font-bold text-gray-900">{avgPosition}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">Unique Ref. Domains</p>
              <p className="text-2xl font-bold text-gray-900">{uniqueDomains.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">On current page</p>
            </div>
          </div>

          {/* Ranking URLs table */}
          {rankingUrlsWithCounts.length > 0 && (
            <div className="bg-white rounded-lg shadow p-5">
              <DataTable
                data={rankingUrlsWithCounts}
                columns={rankingColumns}
                pageSize={25}
                onRowClick={(row) => {
                  setSelectedUrl(selectedUrl === row.url ? null : row.url);
                }}
                getRowClassName={(row) =>
                  row.url === selectedUrl ? "!bg-primary-100" : ""
                }
                statusText={
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">
                      Ranking URLs
                      {selectedUrl && (
                        <button
                          className="text-primary-500 font-normal ml-2 text-xs hover:text-primary-700"
                          onClick={(e) => { e.stopPropagation(); setSelectedUrl(null); }}
                        >
                          Clear filter
                        </button>
                      )}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      URLs ranking for "{data.keyword_query}" between position {minPosition}-{maxPosition}.
                      Click a row to filter backlinks below.
                    </p>
                  </div>
                }
              />
            </div>
          )}

          {/* Backlinks table */}
          <div className="bg-white rounded-lg shadow p-5">
            <DataTable
              data={selectedUrl ? filteredItems : data.items}
              columns={backlinkColumns}
              manualPagination={!selectedUrl}
              pageCount={selectedUrl ? undefined : Math.ceil(data.total / perPage)}
              pageIndex={selectedUrl ? undefined : page - 1}
              onPageChange={(p) => setPage(p + 1)}
              onPageSizeChange={(size) => { setPerPage(size); setPage(1); }}
              pageSize={perPage}
              manualSorting={!selectedUrl}
              onSortChange={handleSortChange}
              statusText={
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">
                    Backlinks
                    {selectedUrl && (
                      <span className="text-primary-500 font-normal ml-2 text-xs">
                        filtered to {selectedUrl}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {selectedUrl
                      ? `${filteredItems.length} backlinks to selected URL`
                      : `${data.total.toLocaleString()} total backlinks to ranking URLs`
                    }
                  </p>
                </div>
              }
              toolbar={
                <ExportButton
                  data={(selectedUrl ? filteredItems : data.items) as unknown as Record<string, unknown>[]}
                  filename={`keyword-urls-backlinks-${data.keyword_query}.csv`}
                />
              }
            />
          </div>

          {rankingUrlsWithCounts.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <p>No URLs found ranking for "{data.keyword_query}" in positions {minPosition}-{maxPosition}.</p>
              <p className="text-sm mt-1">Try a different keyword or wider position range.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
