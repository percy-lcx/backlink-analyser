import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import {
  fetchProfiles,
  fetchWorkspaces,
  setActiveWorkspace,
  saveWorkspaces,
  type Profile,
  type WorkspacesData,
} from "../lib/api";

interface ProfileContextValue {
  profiles: Profile[];
  selected: string;
  setSelected: (name: string) => void;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  // Workspace fields
  activeWorkspace: string | null;
  workspaces: WorkspacesData["workspaces"];
  allDatasets: string[];
  switchWorkspace: (name: string | null) => void;
  refreshWorkspaces: () => void;
  updateWorkspaces: (data: { active: string | null; workspaces: WorkspacesData["workspaces"] }) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
  profiles: [],
  selected: "",
  setSelected: () => {},
  loading: true,
  error: null,
  refresh: () => {},
  activeWorkspace: null,
  workspaces: {},
  allDatasets: [],
  switchWorkspace: () => {},
  refreshWorkspaces: () => {},
  updateWorkspaces: async () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [activeWorkspace, setActiveWs] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspacesData["workspaces"]>({});
  const [allDatasets, setAllDatasets] = useState<string[]>([]);

  const loadProfiles = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetchProfiles()
      .then((data) => {
        if (controller.signal.aborted) return;
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
  }, [selected]);

  const loadWorkspaces = useCallback(() => {
    fetchWorkspaces()
      .then((data) => {
        setActiveWs(data.active);
        setWorkspaces(data.workspaces ?? {});
        setAllDatasets(data.all_datasets ?? []);
      })
      .catch((err) => {
        console.error("[ProfileContext] Failed to load workspaces:", err);
      });
  }, []);

  const switchWorkspace = useCallback(
    (name: string | null) => {
      setActiveWs(name);
      setActiveWorkspace(name)
        .then(() => {
          // Reload profiles (server now filters by active workspace)
          loadProfiles();
        })
        .catch((err) => {
          console.error("[ProfileContext] Failed to switch workspace:", err);
        });
    },
    [loadProfiles],
  );

  const updateWorkspaces = useCallback(
    async (data: { active: string | null; workspaces: WorkspacesData["workspaces"] }) => {
      await saveWorkspaces(data);
      setActiveWs(data.active);
      setWorkspaces(data.workspaces);
      // Reload profiles in case active workspace changed
      loadProfiles();
    },
    [loadProfiles],
  );

  useEffect(() => {
    loadProfiles();
    loadWorkspaces();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        selected,
        setSelected,
        loading,
        error,
        refresh: loadProfiles,
        activeWorkspace,
        workspaces,
        allDatasets,
        switchWorkspace,
        refreshWorkspaces: loadWorkspaces,
        updateWorkspaces,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
