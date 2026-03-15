import { useEffect, useRef, useState, useCallback } from "react";
import { loadSessionFilters, saveSessionFilters } from "./api";

/**
 * Hook to persist tab filter state via the backend session API.
 *
 * @param profile  - Current profile label
 * @param tab      - Tab identifier (links, anchors, domains, pages)
 * @param getFilters - Callback returning current filter values as a flat record
 * @param applyFilters - Callback to restore filter values from a saved record
 * @param skip     - When true, skip session restore (e.g. drilldown active)
 */
export function useSessionFilters(
  profile: string,
  tab: string,
  getFilters: () => Record<string, string>,
  applyFilters: (filters: Record<string, string>) => void,
  skip = false,
): { loaded: boolean; save: () => void } {
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyRef = useRef(applyFilters);
  const getRef = useRef(getFilters);

  // Keep refs current without triggering re-renders
  useEffect(() => { applyRef.current = applyFilters; }, [applyFilters]);
  useEffect(() => { getRef.current = getFilters; }, [getFilters]);

  // Load saved filters on mount or profile change
  useEffect(() => {
    let cancelled = false;

    if (skip) {
      setLoaded(true);
      return;
    }

    loadSessionFilters(profile, tab)
      .then(({ filters }) => {
        if (cancelled) return;
        if (Object.keys(filters).length > 0) {
          applyRef.current(filters);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [profile, tab, skip]);

  // Debounced save — call this after filters change
  const save = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const filters = getRef.current();
      saveSessionFilters(profile, tab, filters).catch(() => {
        /* silent — best effort */
      });
    }, 300);
  }, [profile, tab]);

  // Cleanup timer on unmount or profile change
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [profile, tab]);

  return { loaded, save };
}
