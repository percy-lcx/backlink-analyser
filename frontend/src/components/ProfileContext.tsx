import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { fetchProfiles, type Profile } from "../lib/api";

interface ProfileContextValue {
  profiles: Profile[];
  selected: string;
  setSelected: (name: string) => void;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const ProfileContext = createContext<ProfileContextValue>({
  profiles: [],
  selected: "",
  setSelected: () => {},
  loading: true,
  error: null,
  refresh: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = () => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetchProfiles()
      .then((data) => {
        if (controller.signal.aborted) return;
        console.log("[ProfileContext] Loaded profiles:", data);
        setProfiles(data);
        if (data.length > 0 && !data.find((p) => p.profile_label === selected)) {
          setSelected(data[0].profile_label);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("[ProfileContext] Failed to load profiles:", err);
        setError(String(err));
        setProfiles([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    load();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ProfileContext.Provider value={{ profiles, selected, setSelected, loading, error, refresh: load }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
