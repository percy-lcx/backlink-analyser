import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
  fetchAllAnchorSettings,
  saveProfileAnchorSettings,
  saveGlobalAnchorSettings,
  triggerIngest,
  fetchFiles,
  uploadFiles,
  deleteFile,
  type ProfileAnchorSettings,
  type FileEntry,
} from "../../lib/api";
import { useProfile } from "../ProfileContext";
import BlocklistTab from "./BlocklistTab";

const PAGE_SIZE = 25;

function SettingsSection({ title, description, defaultOpen = false, children }: {
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-8">
      <button
        className="w-full flex items-center justify-between mb-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

interface TermListProps {
  title: string;
  description: string;
  terms: string[];
  onAdd: (term: string) => void;
  onRemove: (term: string) => void;
  placeholder?: string;
  autoTerms?: string[];
  onAutoRemove?: (term: string) => void;
  profileSelector?: ReactNode;
  readOnly?: boolean;
  readOnlyNote?: string;
}

function TermList({ title, description, terms, onAdd, onRemove, placeholder, autoTerms, onAutoRemove, profileSelector, readOnly, readOnlyNote }: TermListProps) {
  const [input, setInput] = useState("");
  const [page, setPage] = useState(0);

  const handleAdd = () => {
    const parts = input.split(/[,\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    for (const p of parts) onAdd(p);
    setInput("");
  };

  const sorted = [...terms].sort();
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const showPagination = sorted.length > PAGE_SIZE;

  // Reset page when terms change significantly
  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  return (
    <div className="bg-white rounded-lg shadow p-5 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {profileSelector}
      </div>
      <p className="text-xs text-gray-400 mb-4">{description}</p>

      {autoTerms && autoTerms.length > 0 && (
        <div className="mb-4">
          <span className="text-xs text-gray-500 font-medium">Auto-detected from domain:</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {autoTerms.map((t) => (
              <span key={t} className="bg-gray-100 text-gray-500 border border-gray-200 rounded-full px-3 py-1 text-xs inline-flex items-center gap-1">
                {t}
                {onAutoRemove && (
                  <button
                    className="text-gray-400 hover:text-red-500 ml-0.5"
                    onClick={() => onAutoRemove(t)}
                    title="Exclude this auto-detected term"
                  >
                    &times;
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {readOnly ? (
        readOnlyNote && (
          <p className="text-xs text-gray-400 italic mb-3">{readOnlyNote}</p>
        )
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder={placeholder ?? "Enter term(s), comma-separated..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <button
            className="px-4 py-2 bg-primary-500 text-white rounded-md text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
            onClick={handleAdd}
            disabled={!input.trim()}
          >
            Add
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">No terms added yet.</p>
      ) : (
        <>
          <div className={`border border-gray-200 rounded-md overflow-hidden mt-4 ${readOnly ? "opacity-60" : ""}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Term</th>
                  {!readOnly && <th className="px-3 py-2 text-right font-semibold text-gray-600 w-24">Action</th>}
                </tr>
              </thead>
              <tbody>
                {paged.map((term, idx) => (
                  <tr key={term} className={`border-b border-gray-100 ${idx % 2 === 1 ? "bg-row-alt" : ""}`}>
                    <td className="px-3 py-2 font-mono text-gray-800">{term}</td>
                    {!readOnly && (
                      <td className="px-3 py-2 text-right">
                        <button
                          className="text-xs text-red-500 hover:text-red-700 hover:underline"
                          onClick={() => onRemove(term)}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showPagination && (
            <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
              <span>{sorted.length} terms total</span>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                >
                  Previous
                </button>
                <span>
                  Page {safePage + 1} of {totalPages}
                </span>
                <button
                  className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProfileOverrideToggle({ isCustom, onToggle, label }: {
  isCustom: boolean;
  onToggle: (custom: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <button
        className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${
          !isCustom
            ? "bg-primary-100 border-primary-300 text-primary-800"
            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
        }`}
        onClick={() => onToggle(false)}
      >
        Use global defaults
      </button>
      <button
        className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${
          isCustom
            ? "bg-primary-100 border-primary-300 text-primary-800"
            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
        }`}
        onClick={() => onToggle(true)}
      >
        Custom for {label}
      </button>
    </div>
  );
}

const DIR_CONFIG: { key: string; label: string; description: string; accept: string }[] = [
  { key: "data/backlinks", label: "Source: Backlinks", description: "CSV/TSV backlink exports", accept: ".csv,.tsv" },
  { key: "data/keywords", label: "Source: Keywords", description: "CSV/TSV keyword exports", accept: ".csv,.tsv" },
  { key: "store", label: "Store: Backlinks", description: "Parquet backlink files", accept: ".parquet" },
  { key: "store/keywords", label: "Store: Keywords", description: "Parquet keyword files", accept: ".parquet" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FilePanel({ dirKey, label, description, accept }: { dirKey: string; label: string; description: string; accept: string }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchFiles(dirKey).then((r) => setFiles(r.files)).catch(() => {}).finally(() => setLoading(false));
  }, [dirKey]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploading(true);
    try {
      await uploadFiles(dirKey, e.target.files);
      load();
    } catch { /* ignore */ }
    finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await deleteFile(dirKey, name);
      setFiles((prev) => prev.filter((f) => f.name !== name));
    } catch { /* ignore */ }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-semibold text-gray-700">{label}</h4>
        <div>
          <input ref={fileRef} type="file" accept={accept} multiple className="hidden" onChange={handleUpload} />
          <button
            className="text-xs text-primary-500 hover:text-primary-700 hover:underline disabled:opacity-50"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-3">{description}</p>

      {loading ? (
        <p className="text-xs text-gray-400 py-4 text-center">Loading...</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No files</p>
      ) : (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-primary-50">
                <th className="px-3 py-1.5 text-left font-semibold text-gray-600">File</th>
                <th className="px-3 py-1.5 text-right font-semibold text-gray-600 w-20">Size</th>
                <th className="px-3 py-1.5 text-right font-semibold text-gray-600 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f, idx) => (
                <tr key={f.name} className={`border-b border-gray-100 ${idx % 2 === 1 ? "bg-row-alt" : ""}`}>
                  <td className="px-3 py-1.5 font-mono text-gray-800 truncate max-w-[200px]" title={f.name}>{f.name}</td>
                  <td className="px-3 py-1.5 text-right text-gray-500">{formatSize(f.size)}</td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      className="text-red-500 hover:text-red-700 hover:underline"
                      onClick={() => handleDelete(f.name)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WorkspaceSection() {
  const { activeWorkspace, workspaces, allDatasets, switchWorkspace, updateWorkspaces } = useProfile();
  const [editName, setEditName] = useState("");
  const [editDatasets, setEditDatasets] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null); // null = not editing, "" = new, "name" = editing existing

  const workspaceNames = Object.keys(workspaces).sort();

  const startCreate = () => {
    setEditing("");
    setEditName("");
    setEditDatasets([]);
  };

  const startEdit = (name: string) => {
    setEditing(name);
    setEditName(name);
    setEditDatasets([...(workspaces[name]?.datasets ?? [])]);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditName("");
    setEditDatasets([]);
  };

  const toggleDataset = (ds: string) => {
    setEditDatasets((prev) =>
      prev.includes(ds) ? prev.filter((d) => d !== ds) : [...prev, ds],
    );
  };

  const saveEdit = async () => {
    const name = editName.trim();
    if (!name) return;
    const next = { ...workspaces };
    // If renaming, remove old key
    if (editing && editing !== "" && editing !== name) {
      delete next[editing];
    }
    next[name] = { datasets: editDatasets };
    // Keep active workspace valid
    const newActive = activeWorkspace === editing && editing !== name ? name : activeWorkspace;
    await updateWorkspaces({ active: newActive, workspaces: next });
    cancelEdit();
  };

  const deleteWorkspace = async (name: string) => {
    const next = { ...workspaces };
    delete next[name];
    const newActive = activeWorkspace === name ? null : activeWorkspace;
    await updateWorkspaces({ active: newActive, workspaces: next });
  };

  return (
    <div>
      {/* Active workspace selector */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Active Workspace</h3>
        <div className="flex items-center gap-3">
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            value={activeWorkspace ?? ""}
            onChange={(e) => switchWorkspace(e.target.value || null)}
          >
            <option value="">All datasets</option>
            {workspaceNames.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">
            {activeWorkspace ? `Showing datasets in "${activeWorkspace}"` : "Showing all datasets"}
          </span>
        </div>
      </div>

      {/* Workspace list */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Workspaces</h3>
          <button
            className="px-3 py-1.5 bg-primary-500 text-white rounded-md text-sm font-medium hover:bg-primary-600"
            onClick={startCreate}
          >
            New Workspace
          </button>
        </div>

        {workspaceNames.length === 0 && editing === null && (
          <p className="text-sm text-gray-400 py-4 text-center">
            No workspaces created. All datasets are shown by default.
          </p>
        )}

        {workspaceNames.length > 0 && (
          <div className="border border-gray-200 rounded-md overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Datasets</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600 w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workspaceNames.map((name, idx) => (
                  <tr key={name} className={`border-b border-gray-100 ${idx % 2 === 1 ? "bg-row-alt" : ""}`}>
                    <td className="px-3 py-2 font-medium text-gray-800">
                      {name}
                      {name === activeWorkspace && (
                        <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded">Active</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {workspaces[name].datasets.length === 0
                        ? <span className="text-gray-400 italic">No datasets</span>
                        : workspaces[name].datasets.join(", ")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="text-xs text-primary-500 hover:text-primary-700 hover:underline mr-3"
                        onClick={() => startEdit(name)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                        onClick={() => deleteWorkspace(name)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create / Edit form */}
        {editing !== null && (
          <div className="border border-primary-200 bg-primary-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              {editing === "" ? "New Workspace" : `Edit "${editing}"`}
            </h4>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. trading, crypto..."
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">Datasets</label>
              {allDatasets.length === 0 ? (
                <p className="text-xs text-gray-400">No datasets available. Ingest some data first.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allDatasets.map((ds) => (
                    <label
                      key={ds}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm cursor-pointer transition-colors ${
                        editDatasets.includes(ds)
                          ? "bg-primary-100 border-primary-300 text-primary-800"
                          : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary-500"
                        checked={editDatasets.includes(ds)}
                        onChange={() => toggleDataset(ds)}
                      />
                      {ds}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 bg-primary-500 text-white rounded-md text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
                onClick={saveEdit}
                disabled={!editName.trim()}
              >
                {editing === "" ? "Create" : "Save"}
              </button>
              <button
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
                onClick={cancelEdit}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DataManagementSection() {
  const { refresh } = useProfile();
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);

  const handleIngest = async () => {
    setIngesting(true);
    setIngestMsg(null);
    try {
      const result = await triggerIngest();
      setIngestMsg(result.status === "ok" ? "Ingestion complete" : `Status: ${result.status}`);
      refresh();
    } catch (err) {
      setIngestMsg(`Failed: ${err}`);
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div>
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 bg-primary-500 text-white rounded-md text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
            onClick={handleIngest}
            disabled={ingesting}
          >
            {ingesting ? "Ingesting..." : "Run Ingestion"}
          </button>
          {ingestMsg && <span className="text-sm text-gray-500">{ingestMsg}</span>}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Parses CSV/TSV files from source directories into Parquet and refreshes the database.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DIR_CONFIG.map((d) => (
          <FilePanel key={d.key} dirKey={d.key} label={d.label} description={d.description} accept={d.accept} />
        ))}
      </div>
    </div>
  );
}

export default function SettingsTab() {
  const [profileSettings, setProfileSettings] = useState<Record<string, ProfileAnchorSettings>>({});
  const [globalTargetKeywords, setGlobalTargetKeywords] = useState<string[]>([]);
  const [globalGenericAnchors, setGlobalGenericAnchors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrandedProfile, setSelectedBrandedProfile] = useState("");
  const [selectedKwProfile, setSelectedKwProfile] = useState("");
  const [selectedGaProfile, setSelectedGaProfile] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetchAllAnchorSettings()
      .then((data) => {
        setProfileSettings(data.profiles);
        setGlobalTargetKeywords(data.target_keywords);
        setGlobalGenericAnchors(data.generic_anchors);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveGlobal = useCallback((keywords: string[], generic: string[]) => {
    saveGlobalAnchorSettings(generic, keywords).catch(() => {});
  }, []);

  // --- Branded terms handlers (per-profile) ---
  const saveProfile = useCallback((profileLabel: string, settings: ProfileAnchorSettings) => {
    saveProfileAnchorSettings(
      profileLabel,
      settings.branded_terms,
      settings.excluded_auto_terms,
      settings.has_custom_target_keywords ? settings.target_keywords : null,
      settings.has_custom_generic_anchors ? settings.generic_anchors : null,
    ).catch(() => {});
  }, []);

  const addBranded = useCallback((profileLabel: string, term: string) => {
    setProfileSettings((prev) => {
      const current = prev[profileLabel];
      if (!current || current.branded_terms.includes(term)) return prev;
      const next = { ...current, branded_terms: [...current.branded_terms, term] };
      saveProfile(profileLabel, next);
      return { ...prev, [profileLabel]: next };
    });
  }, [saveProfile]);

  const removeBranded = useCallback((profileLabel: string, term: string) => {
    setProfileSettings((prev) => {
      const current = prev[profileLabel];
      if (!current) return prev;
      const next = { ...current, branded_terms: current.branded_terms.filter((t) => t !== term) };
      saveProfile(profileLabel, next);
      return { ...prev, [profileLabel]: next };
    });
  }, [saveProfile]);

  const excludeAutoTerm = useCallback((profileLabel: string, term: string) => {
    setProfileSettings((prev) => {
      const current = prev[profileLabel];
      if (!current) return prev;
      const next = {
        ...current,
        auto_branded_terms: current.auto_branded_terms.filter((t) => t !== term),
        excluded_auto_terms: [...current.excluded_auto_terms, term],
      };
      saveProfile(profileLabel, next);
      return { ...prev, [profileLabel]: next };
    });
  }, [saveProfile]);

  // --- Target keywords handlers (global) ---
  const addGlobalKeyword = useCallback((term: string) => {
    setGlobalTargetKeywords((prev) => {
      if (prev.includes(term)) return prev;
      const next = [...prev, term];
      saveGlobal(next, globalGenericAnchors);
      return next;
    });
  }, [saveGlobal, globalGenericAnchors]);

  const removeGlobalKeyword = useCallback((term: string) => {
    setGlobalTargetKeywords((prev) => {
      const next = prev.filter((t) => t !== term);
      saveGlobal(next, globalGenericAnchors);
      return next;
    });
  }, [saveGlobal, globalGenericAnchors]);

  // --- Generic anchors handlers (global) ---
  const addGlobalGeneric = useCallback((term: string) => {
    setGlobalGenericAnchors((prev) => {
      if (prev.includes(term)) return prev;
      const next = [...prev, term];
      saveGlobal(globalTargetKeywords, next);
      return next;
    });
  }, [saveGlobal, globalTargetKeywords]);

  const removeGlobalGeneric = useCallback((term: string) => {
    setGlobalGenericAnchors((prev) => {
      const next = prev.filter((t) => t !== term);
      saveGlobal(globalTargetKeywords, next);
      return next;
    });
  }, [saveGlobal, globalTargetKeywords]);

  // --- Per-profile target keywords handlers ---
  const toggleCustomKeywords = useCallback((profileLabel: string, custom: boolean) => {
    setProfileSettings((prev) => {
      const current = prev[profileLabel];
      if (!current) return prev;
      const next: ProfileAnchorSettings = custom
        ? { ...current, has_custom_target_keywords: true, target_keywords: [...globalTargetKeywords] }
        : { ...current, has_custom_target_keywords: false, target_keywords: globalTargetKeywords };
      saveProfileAnchorSettings(
        profileLabel,
        next.branded_terms,
        next.excluded_auto_terms,
        custom ? next.target_keywords : null,
        next.has_custom_generic_anchors ? next.generic_anchors : null,
      ).catch(() => {});
      return { ...prev, [profileLabel]: next };
    });
  }, [globalTargetKeywords]);

  const addProfileKeyword = useCallback((profileLabel: string, term: string) => {
    setProfileSettings((prev) => {
      const current = prev[profileLabel];
      if (!current || current.target_keywords.includes(term)) return prev;
      const next = { ...current, target_keywords: [...current.target_keywords, term] };
      saveProfile(profileLabel, next);
      return { ...prev, [profileLabel]: next };
    });
  }, [saveProfile]);

  const removeProfileKeyword = useCallback((profileLabel: string, term: string) => {
    setProfileSettings((prev) => {
      const current = prev[profileLabel];
      if (!current) return prev;
      const next = { ...current, target_keywords: current.target_keywords.filter((t) => t !== term) };
      saveProfile(profileLabel, next);
      return { ...prev, [profileLabel]: next };
    });
  }, [saveProfile]);

  // --- Per-profile generic anchors handlers ---
  const toggleCustomGenericAnchors = useCallback((profileLabel: string, custom: boolean) => {
    setProfileSettings((prev) => {
      const current = prev[profileLabel];
      if (!current) return prev;
      const next: ProfileAnchorSettings = custom
        ? { ...current, has_custom_generic_anchors: true, generic_anchors: [...globalGenericAnchors] }
        : { ...current, has_custom_generic_anchors: false, generic_anchors: globalGenericAnchors };
      saveProfileAnchorSettings(
        profileLabel,
        next.branded_terms,
        next.excluded_auto_terms,
        next.has_custom_target_keywords ? next.target_keywords : null,
        custom ? next.generic_anchors : null,
      ).catch(() => {});
      return { ...prev, [profileLabel]: next };
    });
  }, [globalGenericAnchors]);

  const addProfileGeneric = useCallback((profileLabel: string, term: string) => {
    setProfileSettings((prev) => {
      const current = prev[profileLabel];
      if (!current || current.generic_anchors.includes(term)) return prev;
      const next = { ...current, generic_anchors: [...current.generic_anchors, term] };
      saveProfile(profileLabel, next);
      return { ...prev, [profileLabel]: next };
    });
  }, [saveProfile]);

  const removeProfileGeneric = useCallback((profileLabel: string, term: string) => {
    setProfileSettings((prev) => {
      const current = prev[profileLabel];
      if (!current) return prev;
      const next = { ...current, generic_anchors: current.generic_anchors.filter((t) => t !== term) };
      saveProfile(profileLabel, next);
      return { ...prev, [profileLabel]: next };
    });
  }, [saveProfile]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading settings...</div>;
  }

  const profileLabels = Object.keys(profileSettings).sort();

  // Keep selections valid
  const activeBrandedProfile = profileLabels.includes(selectedBrandedProfile)
    ? selectedBrandedProfile
    : profileLabels[0] ?? "";
  const activeKwProfile = profileLabels.includes(selectedKwProfile)
    ? selectedKwProfile
    : profileLabels[0] ?? "";
  const activeGaProfile = profileLabels.includes(selectedGaProfile)
    ? selectedGaProfile
    : profileLabels[0] ?? "";

  const profileDropdown = (selected: string, onChange: (v: string) => void) =>
    profileLabels.length > 1 ? (
      <select
        className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        {profileLabels.map((label) => (
          <option key={label} value={label}>{label}</option>
        ))}
      </select>
    ) : (
      <span className="text-sm font-medium text-gray-600">{selected}</span>
    );

  const kwSettings = activeKwProfile ? profileSettings[activeKwProfile] : null;
  const gaSettings = activeGaProfile ? profileSettings[activeGaProfile] : null;

  return (
    <div>
      <SettingsSection title="Workspaces" description="Group datasets by vertical or niche. Select a workspace to filter which datasets appear across the app." defaultOpen>
        <WorkspaceSection />
      </SettingsSection>

      <SettingsSection title="Anchor Text Matching" description="Configure how anchor text is categorised across your profiles.">
        {/* Branded terms — single panel with profile dropdown */}
        {activeBrandedProfile && (
          <TermList
            key={activeBrandedProfile}
            title="Branded Terms"
            description="Anchors containing these terms are categorized as branded. Auto-detected terms from the target domain are always included."
            terms={profileSettings[activeBrandedProfile].branded_terms}
            onAdd={(term) => addBranded(activeBrandedProfile, term)}
            onRemove={(term) => removeBranded(activeBrandedProfile, term)}
            placeholder="e.g. my brand, mybrand..."
            autoTerms={profileSettings[activeBrandedProfile].auto_branded_terms}
            onAutoRemove={(term) => excludeAutoTerm(activeBrandedProfile, term)}
            profileSelector={profileDropdown(activeBrandedProfile, setSelectedBrandedProfile)}
          />
        )}

        {/* Target keywords — per-profile with global fallback */}
        {activeKwProfile && kwSettings && (
          <div className="bg-white rounded-lg shadow p-5 mb-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-700">Target Keywords</h3>
              {profileDropdown(activeKwProfile, setSelectedKwProfile)}
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Anchors matching these keywords are categorized as exact match or partial match.
            </p>
            <ProfileOverrideToggle
              isCustom={kwSettings.has_custom_target_keywords}
              onToggle={(custom) => toggleCustomKeywords(activeKwProfile, custom)}
              label={activeKwProfile}
            />
            {kwSettings.has_custom_target_keywords ? (
              <TermList
                key={`kw-custom-${activeKwProfile}`}
                title=""
                description=""
                terms={kwSettings.target_keywords}
                onAdd={(term) => addProfileKeyword(activeKwProfile, term)}
                onRemove={(term) => removeProfileKeyword(activeKwProfile, term)}
                placeholder="e.g. forex trading, demo account..."
              />
            ) : (
              <TermList
                key={`kw-global-${activeKwProfile}`}
                title=""
                description=""
                terms={globalTargetKeywords}
                onAdd={addGlobalKeyword}
                onRemove={removeGlobalKeyword}
                placeholder="e.g. forex trading, demo account..."
                readOnlyNote="Editing global defaults. Changes apply to all profiles using global settings."
              />
            )}
          </div>
        )}

        {/* Generic anchors — per-profile with global fallback */}
        {activeGaProfile && gaSettings && (
          <div className="bg-white rounded-lg shadow p-5 mb-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-700">Generic Anchors</h3>
              {profileDropdown(activeGaProfile, setSelectedGaProfile)}
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Anchors containing these terms are categorized as generic.
            </p>
            <ProfileOverrideToggle
              isCustom={gaSettings.has_custom_generic_anchors}
              onToggle={(custom) => toggleCustomGenericAnchors(activeGaProfile, custom)}
              label={activeGaProfile}
            />
            {gaSettings.has_custom_generic_anchors ? (
              <TermList
                key={`ga-custom-${activeGaProfile}`}
                title=""
                description=""
                terms={gaSettings.generic_anchors}
                onAdd={(term) => addProfileGeneric(activeGaProfile, term)}
                onRemove={(term) => removeProfileGeneric(activeGaProfile, term)}
                placeholder="e.g. click here, read more..."
              />
            ) : (
              <TermList
                key={`ga-global-${activeGaProfile}`}
                title=""
                description=""
                terms={globalGenericAnchors}
                onAdd={addGlobalGeneric}
                onRemove={removeGlobalGeneric}
                placeholder="e.g. click here, read more..."
                readOnlyNote="Editing global defaults. Changes apply to all profiles using global settings."
              />
            )}
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Domain Blocking" description="Manage domains to flag across all tables.">
        <BlocklistTab />
      </SettingsSection>

      <SettingsSection title="Data Management" description="Upload, delete source files and manage ingestion.">
        <DataManagementSection />
      </SettingsSection>
    </div>
  );
}
