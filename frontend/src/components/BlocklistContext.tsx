import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { fetchBlocklist, saveBlocklist, clearProfileBlocklist } from "../lib/api";
import { useProfile } from "./ProfileContext";

interface BlocklistContextValue {
  blocklist: Set<string>;
  isCustom: boolean;
  add: (domain: string) => void;
  addMany: (domains: string[]) => void;
  remove: (domain: string) => void;
  clear: () => void;
  refresh: () => void;
  revertToGlobal: () => void;
}

const BlocklistContext = createContext<BlocklistContextValue>({
  blocklist: new Set(),
  isCustom: false,
  add: () => {},
  addMany: () => {},
  remove: () => {},
  clear: () => {},
  refresh: () => {},
  revertToGlobal: () => {},
});

function cleanDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function BlocklistProvider({ children }: { children: ReactNode }) {
  const { selected: profile } = useProfile();
  const [blocklist, setBlocklist] = useState<Set<string>>(new Set());
  const [isCustom, setIsCustom] = useState(false);

  const load = useCallback(() => {
    fetchBlocklist(profile || null)
      .then((res) => {
        setBlocklist(new Set(res.domains));
        setIsCustom(res.is_custom);
      })
      .catch(() => {});
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const persist = useCallback((next: Set<string>) => {
    setBlocklist(next);
    saveBlocklist([...next], profile || null).catch(() => {});
  }, [profile]);

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

  const clear = useCallback(() => {
    persist(new Set());
  }, [persist]);

  const revertToGlobal = useCallback(() => {
    if (!profile) return;
    clearProfileBlocklist(profile)
      .then(() => load())
      .catch(() => {});
  }, [profile, load]);

  return (
    <BlocklistContext.Provider value={{ blocklist, isCustom, add, addMany, remove, clear, refresh: load, revertToGlobal }}>
      {children}
    </BlocklistContext.Provider>
  );
}

export function useBlocklist() {
  return useContext(BlocklistContext);
}
