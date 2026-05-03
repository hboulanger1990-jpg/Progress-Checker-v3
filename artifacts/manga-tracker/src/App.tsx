import { useState, useEffect, useCallback, useRef } from "react";
import type { AccentColor, Folder, Work, Section } from "./types";
import { loadFolders, saveFolders, loadFoldersFromCloud, saveFoldersToCloud } from "./storage";
import { supabase } from "./lib/supabase";
import FolderListScreen from "./screens/FolderListScreen";
import WorkListScreen from "./screens/WorkListScreen";
import WorkDetailScreen from "./screens/WorkDetailScreen";
import type { User } from "@supabase/supabase-js";

type View =
  | { screen: "folders" }
  | { screen: "works"; folderId: string }
  | { screen: "detail"; folderId: string; workId: string };

const LOCK_KEY = "pc-locked";

export default function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [view, setView] = useState<View>({ screen: "folders" });
  const [fading, setFading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState<boolean>(() => {
    return localStorage.getItem(LOCK_KEY) === "true";
  });
  const initialLoadDone = useRef(false);

  useEffect(() => {
    localStorage.setItem(LOCK_KEY, locked ? "true" : "false");
  }, [locked]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function load() {
      if (!initialLoadDone.current) setLoading(true);
      if (user) {
        const cloud = await loadFoldersFromCloud(user.id);
        if (cloud) {
          setFolders(cloud);
        } else {
          const local = loadFolders();
          setFolders(local);
          if (local.length > 0) await saveFoldersToCloud(user.id, local);
        }
      } else {
        setFolders(loadFolders());
      }
      setLoading(false);
      initialLoadDone.current = true;
    }
    load();
  }, [user]);

  useEffect(() => {
    if (loading) return;
    saveFolders(folders);
    if (user) saveFoldersToCloud(user.id, folders);
  }, [folders]);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const applyView = useCallback((next: View) => {
    setFading(true);
    setTimeout(() => { setView(next); setFading(false); }, 110);
  }, []);

  useEffect(() => {
    history.replaceState({ screen: "folders" } satisfies View, "");
    let justBecameVisible = false;
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        justBecameVisible = true;
        setTimeout(() => { justBecameVisible = false; }, 1000);
      }
    }
    function handlePop(e: PopStateEvent) {
      if (justBecameVisible) return;
      const v = e.state as View | null;
      if (!v?.screen) return;
      applyView(v);
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("popstate", handlePop);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("popstate", handlePop);
    };
  }, [applyView]);

  function navigate(next: View) {
    history.pushState(next, "");
    applyView(next);
  }

  function goBack() {
    history.back();
  }

  function mutate(updater: (prev: Folder[]) => Folder[]) {
    setFolders((prev) => {
      const next = updater(prev);
      saveFolders(next);
      return next;
    });
  }

  // ---- Folder CRUD ----
  function addFolder(title: string, color: AccentColor, type: "progress" | "read", defaultLabelUnread: string, defaultLabelRead: string, defaultUnit: string) {
    const f: Folder = { id: crypto.randomUUID(), title, accentColor: color, type, defaultLabelUnread, defaultLabelRead, defaultUnit, works: [], updatedAt: Date.now() };
    mutate((prev) => [f, ...prev]);
  }
  function editFolder(id: string, title: string, color: AccentColor, type: "progress" | "read", defaultLabelUnread: string, defaultLabelRead: string, defaultUnit: string) {
    mutate((prev) => prev.map((f) => f.id === id ? { ...f, title, accentColor: color, type, defaultLabelUnread, defaultLabelRead, defaultUnit, updatedAt: Date.now() } : f).sort((a, b) => b.updatedAt - a.updatedAt));
  }
  function deleteFolder(id: string) {
    mutate((prev) => prev.filter((f) => f.id !== id));
  }

  function reorderFolders(newFolders: Folder[]) {
    mutate(() => newFolders);
  }

  // ---- Work CRUD ----
  function addWork(folderId: string, data: { title: string; accentColor: AccentColor; labelUnread: string; labelRead: string; unit: string; sectionLabel: string; tags: string[] }) {
    const work: Work = { ...data, id: crypto.randomUUID(), sections: [], updatedAt: Date.now() };
    mutate((prev) => prev.map((f) => f.id !== folderId ? f : { ...f, works: [work, ...f.works], updatedAt: Date.now() }));
  }
  function editWork(folderId: string, workId: string, updates: Partial<Pick<Work, "title" | "accentColor" | "labelUnread" | "labelRead" | "unit" | "sectionLabel" | "tags" | "sortOrder">>) {
    mutate((prev) => prev.map((f) => {
      if (f.id !== folderId) return f;
      const updatedWorks = f.works.map((w) => w.id !== workId ? w : { ...w, ...updates, updatedAt: Date.now() });
      const sorted = f.type === "read" ? updatedWorks : updatedWorks.sort((a, b) => b.updatedAt - a.updatedAt);
      return { ...f, updatedAt: Date.now(), works: sorted };
    }));
  }
  function deleteWork(folderId: string, workId: string) {
    mutate((prev) => prev.map((f) => f.id !== folderId ? f : { ...f, works: f.works.filter((w) => w.id !== workId), updatedAt: Date.now() }));
  }

  function reorderWorks(folderId: string, newWorks: Work[]) {
    mutate((prev) => prev.map((f) => f.id !== folderId ? f : { ...f, works: newWorks }));
  }

  function toggleWorkCompleted(folderId: string, workId: string) {
    mutate((prev) => prev.map((f) => f.id !== folderId ? f : {
      ...f,
      updatedAt: Date.now(),
      works: f.works.map((w) => w.id !== workId ? w : { ...w, completed: !w.completed, updatedAt: Date.now() }),
    }));
  }

  // ---- Section CRUD ----
  function addSection(folderId: string, workId: string, s: Omit<Section, "id" | "statuses">) {
    const section: Section = { ...s, id: crypto.randomUUID(), statuses: {} };
    mutate((prev) => prev.map((f) => f.id !== folderId ? f : { ...f, updatedAt: Date.now(), works: f.works.map((w) => w.id !== workId ? w : { ...w, sections: [...w.sections, section], updatedAt: Date.now() }).sort((a, b) => b.updatedAt - a.updatedAt) }));
  }
  function editSection(folderId: string, workId: string, sectionId: string, updates: Partial<Pick<Section, "label" | "startNum" | "endNum" | "mode" | "items" | "sortOrder">>) {
    mutate((prev) => prev.map((f) => f.id !== folderId ? f : { ...f, updatedAt: Date.now(), works: f.works.map((w) => w.id !== workId ? w : { ...w, updatedAt: Date.now(), sections: w.sections.map((s) => s.id !== sectionId ? s : { ...s, ...updates }) }).sort((a, b) => b.updatedAt - a.updatedAt) }));
  }
  function deleteSection(folderId: string, workId: string, sectionId: string) {
    mutate((prev) => prev.map((f) => f.id !== folderId ? f : { ...f, updatedAt: Date.now(), works: f.works.map((w) => w.id !== workId ? w : { ...w, updatedAt: Date.now(), sections: w.sections.filter((s) => s.id !== sectionId) }).sort((a, b) => b.updatedAt - a.updatedAt) }));
  }

  function reorderSections(folderId: string, workId: string, newSections: Section[]) {
    mutate((prev) => prev.map((f) => f.id !== folderId ? f : {
      ...f,
      updatedAt: Date.now(),
      works: f.works.map((w) => w.id !== workId ? w : { ...w, sections: newSections, updatedAt: Date.now() })
        .sort((a, b) => b.updatedAt - a.updatedAt),
    }));
  }

  function reorderItems(folderId: string, workId: string, sectionId: string, newItems: string[], newStatuses: Section["statuses"]) {
    mutate((prev) => prev.map((f) => f.id !== folderId ? f : {
      ...f,
      updatedAt: Date.now(),
      works: f.works.map((w) => w.id !== workId ? w : {
        ...w,
        updatedAt: Date.now(),
        sections: w.sections.map((s) => s.id !== sectionId ? s : { ...s, items: newItems, statuses: newStatuses }),
      }).sort((a, b) => b.updatedAt - a.updatedAt),
    }));
  }

  function toggleItem(folderId: string, workId: string, sectionId: string, num: number) {
    mutate((prev) => prev.map((f) => f.id !== folderId ? f : { ...f, updatedAt: Date.now(), works: f.works.map((w) => w.id !== workId ? w : { ...w, updatedAt: Date.now(), sections: w.sections.map((s) => { if (s.id !== sectionId) return s; const next = { ...s.statuses }; if (next[num]) delete next[num]; else next[num] = "read"; return { ...s, statuses: next }; }) }).sort((a, b) => b.updatedAt - a.updatedAt) }));
  }

  function importHandler(data: Folder[]) {
    const sorted = [...data].sort((a, b) => b.updatedAt - a.updatedAt);
    setFolders(sorted);
    saveFolders(sorted);
    navigate({ screen: "folders" });
  }

  const currentFolder = view.screen !== "folders" ? folders.find((f) => f.id === (view as { folderId: string }).folderId) : undefined;
  const currentWork = view.screen === "detail" && currentFolder ? currentFolder.works.find((w) => w.id === (view as { workId: string }).workId) : undefined;

  if (loading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: "#ccc" }}>読み込み中...</div>;

  return (
    <div style={{ opacity: fading ? 0 : 1, transition: "opacity 0.11s ease" }}>
      {view.screen === "folders" && (
        <FolderListScreen
          folders={folders}
          user={user}
          locked={locked}
          onToggleLock={() => setLocked((v) => !v)}
          onSignIn={signInWithGoogle}
          onSignOut={signOut}
          onSelect={(f) => navigate({ screen: "works", folderId: f.id })}
          onAdd={addFolder}
          onEdit={editFolder}
          onDelete={deleteFolder}
          onReorder={reorderFolders}
          onImport={importHandler}
        />
      )}
      {view.screen === "works" && currentFolder && (
        <WorkListScreen
          folder={currentFolder}
          locked={locked}
          onToggleLock={() => setLocked((v) => !v)}
          onBack={goBack}
          onSelect={(w) => navigate({ screen: "detail", folderId: currentFolder.id, workId: w.id })}
          onToggleCompleted={(wId) => toggleWorkCompleted(currentFolder.id, wId)}
          onAdd={(data) => addWork(currentFolder.id, data)}
          onEdit={(wId, updates) => editWork(currentFolder.id, wId, updates)}
          onDelete={(wId) => deleteWork(currentFolder.id, wId)}
          onReorder={(newWorks) => reorderWorks(currentFolder.id, newWorks)}
        />
      )}
      {view.screen === "detail" && currentFolder && currentWork && (
        <WorkDetailScreen
          folder={currentFolder}
          work={currentWork}
          locked={locked}
          onToggleLock={() => setLocked((v) => !v)}
          onBack={goBack}
          onEditWork={(updates) => editWork(currentFolder.id, currentWork.id, updates)}
          onDeleteWork={() => { deleteWork(currentFolder.id, currentWork.id); navigate({ screen: "works", folderId: currentFolder.id }); }}
          onAddSection={(s) => addSection(currentFolder.id, currentWork.id, s)}
          onEditSection={(sId, u) => editSection(currentFolder.id, currentWork.id, sId, u)}
          onDeleteSection={(sId) => deleteSection(currentFolder.id, currentWork.id, sId)}
          onToggleItem={(sId, n) => toggleItem(currentFolder.id, currentWork.id, sId, n)}
          onReorderSections={(newSections) => reorderSections(currentFolder.id, currentWork.id, newSections)}
          onReorderItems={(sId, newItems, newStatuses) => reorderItems(currentFolder.id, currentWork.id, sId, newItems, newStatuses)}
        />
      )}
    </div>
  );
}
