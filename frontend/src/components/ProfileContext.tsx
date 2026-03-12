import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { fetchProfiles, type Profile } from "../lib/api";

interface ProfileContextValue {
  profiles: Profile[];
  selected: string;
  setSelected: (name: string) => void;
  loading: boolean;
  refresh: () => void;
}

const ProfileContext = createContext<ProfileContextValue>({
  profiles: [],
  selected: "",
  setSelected: () => {},
  loading: true,
  refresh: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchProfiles()
      .then((data) => {
        setProfiles(data);
        if (data.length > 0 && !data.find((p) => p.profile_label === selected)) {
          setSelected(data[0].profile_label);
        }
      })
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ProfileContext.Provider value={{ profiles, selected, setSelected, loading, refresh: load }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
