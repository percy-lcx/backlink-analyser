import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { fetchBlocklist, saveBlocklist } from "../lib/api";

interface BlocklistContextValue {
  blocklist: Set<string>;
  add: (domain: string) => void;
  addMany: (domains: string[]) => void;
  remove: (domain: string) => void;
  refresh: () => void;
}

const BlocklistContext = createContext<BlocklistContextValue>({
  blocklist: new Set(),
  add: () => {},
  addMany: () => {},
  remove: () => {},
  refresh: () => {},
});

function cleanDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function BlocklistProvider({ children }: { children: ReactNode }) {
  const [blocklist, setBlocklist] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    fetchBlocklist()
      .then((res) => setBlocklist(new Set(res.domains)))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = useCallback((next: Set<string>) => {
    setBlocklist(next);
    saveBlocklist([...next]).catch(() => {});
  }, []);

  const add = useCallback((domain: string) => {
    const d = cleanDomain(domain);
    if (!d) return;
    setBlocklist((prev) => {
      const next = new Set(prev);
      next.add(d);
      persist(next);
      return next;
    });
  }, [persist]);

  const addMany = useCallback((domains: string[]) => {
    setBlocklist((prev) => {
      const next = new Set(prev);
      for (const raw of domains) {
        const d = cleanDomain(raw);
        if (d) next.add(d);
      }
      persist(next);
      return next;
    });
  }, [persist]);

  const remove = useCallback((domain: string) => {
    setBlocklist((prev) => {
      const next = new Set(prev);
      next.delete(domain);
      persist(next);
      return next;
    });
  }, [persist]);

  return (
    <BlocklistContext.Provider value={{ blocklist, add, addMany, remove, refresh: load }}>
      {children}
    </BlocklistContext.Provider>
  );
}

export function useBlocklist() {
  return useContext(BlocklistContext);
}
