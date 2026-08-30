import { useState, useEffect, useCallback, useRef } from "react";
import type { AccentColor, Folder, FolderPattern, Work, Section } from "./types";
import { loadFolders, saveFolders, loadFoldersFromCloud, saveFoldersToCloud } from "./storage";
import { supabase } from "./lib/supabase";
import FolderListScreen from "./screens/FolderListScreen";
import GenreListScreen from "./screens/GenreListScreen";
import WorkListScreen from "./screens/WorkListScreen";
import WorkDetailScreen from "./screens/WorkDetailScreen";
import StockScreen from "./screens/StockScreen";
import VocabScreen from "./screens/VocabScreen";
import type { User } from "@supabase/supabase-js";

type View =
  | { screen: "folders" }
  | { screen: "genres"; folderId: string }
  | { screen: "works"; folderId: string; genre?: string | null }
  | { screen: "detail"; folderId: string; workId: string };

const LOCK_KEY = "pc-locked";
const THEME_KEY = "pc-theme";

// #tango-card をブックマークして直接開くと、Tangoのカードモード・スタート画面が自動で開く
const CARD_MODE_HASH = "#tango-card";
function shouldAutoStartCardMode() {
  return window.location.hash === CARD_MODE_HASH;
}

export default function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [view, setView] = useState<View>({ screen: "folders" });
  const [fading, setFading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState<boolean>(() => {
    return localStorage.getItem(LOCK_KEY) === "true";
  });
  const [theme, setTheme] = useState<"dark" | "light" | "sepia">(() => {
    return (localStorage.getItem(THEME_KEY) as "dark" | "light" | "sepia") ?? "dark";
  });
  const [appMode, setAppMode] = useState<"progress" | "stock" | "vocab">(() => shouldAutoStartCardMode() ? "vocab" : "progress");
  // #tango-card から起動した場合のみtrue。VocabScreen側でスタート画面を開いたら消費（false化）される一度きりのフラグ
  const [autoStartVocabCard, setAutoStartVocabCard] = useState<boolean>(() => shouldAutoStartCardMode());
  const initialLoadDone = useRef(false);

  useEffect(() => {
    localStorage.setItem(LOCK_KEY, locked ? "true" : "false");
  }, [locked]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    // Supabaseはログイン中も裏側で定期的に認証トークンを更新しており（デフォルト約1時間ごと）、
    // そのたびにonAuthStateChangeが発火する。このとき返ってくるsession.userは、
    // 中身（ユーザーID）が同じでも毎回新しく作られた別オブジェクトなので、
    // 素朴にsetUserすると「userが変わった」とReactに判定されてしまい、
    // userを依存配列に持つ各画面のクラウド読み込みuseEffectが作業中に再発火し、
    // その時点でまだクラウドに反映しきっていない古いデータで画面の状態を上書きしてしまう
    // （実際にTangoで発生した不具合の原因）。
    // これを防ぐため、ユーザーIDが変わっていなければsetUserを呼ばず、同じオブジェクト参照を保つ。
    const applyUser = (nextUser: User | null) => {
      setUser((prev) => {
        const prevId = prev?.id ?? null;
        const nextId = nextUser?.id ?? null;
        return prevId === nextId && prevId !== null ? prev : nextUser;
      });
    };
    supabase.auth.getSession().then(({ data: { session } }) => {
      applyUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
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
    // #tango-card は一度きりの起動トリガーなので、読み取ったらURLからは消しておく
    // （リロードや「戻る」のたびに毎回スタート画面が開いてしまうのを防ぐため）
    const url = window.location.hash === CARD_MODE_HASH
      ? window.location.pathname + window.location.search
      : undefined;
    history.replaceState({ screen: "folders" } satisfies View, "", url);
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
  function addFolder(title: string, color: AccentColor, type: "progress" | "read", defaultLabelUnread: string, defaultLabelRead: string, defaultUnit: string, itemSize: "1" | "2" | "full", pattern: FolderPattern) {
    const f: Folder = { id: crypto.randomUUID(), title, accentColor: color, type, defaultLabelUnread, defaultLabelRead, defaultUnit, itemSize, pattern, works: [], updatedAt: Date.now() };
    mutate((prev) => [f, ...prev]);
  }
  function editFolder(id: string, title: string, color: AccentColor, type: "progress" | "read", defaultLabelUnread: string, defaultLabelRead: string, defaultUnit: string, itemSize: "1" | "2" | "full", pattern: FolderPattern) {
    mutate((prev) => prev.map((f) => f.id === id ? { ...f, title, accentColor: color, type, defaultLabelUnread, defaultLabelRead, defaultUnit, itemSize, pattern, updatedAt: Date.now() } : f));
  }
  function deleteFolder(id: string) {
    mutate((prev) => prev.filter((f) => f.id !== id));
  }

  function reorderFolders(newFolders: Folder[]) {
    mutate(() => newFolders);
  }

  // ---- Genre CRUD（read型フォルダ専用。folder.genres は名前リストのみを保持し、
  //      各Workへの割り当ては work.genre で行う） ----
  function addGenre(folderId: string, name: string) {
    mutate((prev) => prev.map((f) => f.id !== folderId ? f : { ...f, genres: [...(f.genres ?? []), name], updatedAt: Date.now() }));
  }
  function editGenre(folderId: string, oldName: string, newName: string) {
    mutate((prev) => prev.map((f) => {
      if (f.id !== folderId) return f;
      return {
        ...f,
        genres: (f.genres ?? []).map((g) => g === oldName ? newName : g),
        works: f.works.map((w) => w.genre !== oldName ? w : { ...w, genre: newName }),
        updatedAt: Date.now(),
      };
    }));
  }
  function deleteGenre(folderId: string, name: string) {
    // ジャンル名をfolder.genresから外し、そのジャンルに属していた作品も丸ごと削除する
    // （F画面のフォルダ削除と同じ「フォルダ／ジャンルごと中身も削除される」という挙動に統一。
    //   以前は work.genre を書き換えずに残していたため、削除するたびに未分類へ作品が溜まってしまっていた）
    mutate((prev) => prev.map((f) => {
      if (f.id !== folderId) return f;
      return {
        ...f,
        genres: (f.genres ?? []).filter((g) => g !== name),
        works: f.works.filter((w) => w.genre !== name),
        updatedAt: Date.now(),
      };
    }));
  }

  // 複数フォルダの中身（works・genres）を1つのフォルダに統合し、統合元フォルダは削除する。
  // 統合元フォルダの時点で「未分類」だった作品（work.genreが未設定、または統合元のgenresに存在しない値）には、
  // 統合元フォルダ名をそのまま新しいジャンル名として自動的に割り当てる。
  // これにより統合直後から「どのフォルダから来たか」で仕分けられた状態になる（既存の未分類と混ざらない）
  function mergeFolders(sourceIds: string[], targetId: string) {
    mutate((prev) => {
      const target = prev.find((f) => f.id === targetId);
      if (!target) return prev;
      const sources = prev.filter((f) => sourceIds.includes(f.id));

      const taggedSourceWorks = sources.flatMap((f) => {
        const ownGenres = f.genres ?? [];
        return f.works.map((w) => {
          const hasValidGenre = w.genre && ownGenres.includes(w.genre);
          return hasValidGenre ? w : { ...w, genre: f.title };
        });
      });
      const sourceDerivedGenres = sources.map((f) => f.title);

      const mergedWorks = [...target.works, ...taggedSourceWorks];
      const mergedGenres = Array.from(new Set([
        ...(target.genres ?? []),
        ...sources.flatMap((f) => f.genres ?? []),
        ...sourceDerivedGenres,
      ]));

      return prev
        .filter((f) => !sourceIds.includes(f.id))
        .map((f) => f.id === targetId ? { ...f, works: mergedWorks, genres: mergedGenres, updatedAt: Date.now() } : f);
    });
  }

  // 同一フォルダ内の特定ジャンル（複数可）の作品だけを、別フォルダへ移す。
  // 移動元フォルダの genres からは対象ジャンル名を除去し、移動先フォルダの genres には
  // 重複しない形で追加する（すでに同名ジャンルがあれば追加せず、作品だけがそこに合流する）
  function mergeGenres(folderId: string, genreNames: string[], targetFolderId: string) {
    mutate((prev) => {
      const source = prev.find((f) => f.id === folderId);
      const target = prev.find((f) => f.id === targetFolderId);
      if (!source || !target) return prev;
      const movingWorks = source.works.filter((w) => w.genre && genreNames.includes(w.genre));
      const remainingWorks = source.works.filter((w) => !(w.genre && genreNames.includes(w.genre)));
      const newTargetGenres = Array.from(new Set([...(target.genres ?? []), ...genreNames]));
      const newSourceGenres = (source.genres ?? []).filter((g) => !genreNames.includes(g));
      return prev.map((f) => {
        if (f.id === folderId) return { ...f, works: remainingWorks, genres: newSourceGenres, updatedAt: Date.now() };
        if (f.id === targetFolderId) return { ...f, works: [...target.works, ...movingWorks], genres: newTargetGenres, updatedAt: Date.now() };
        return f;
      });
    });
  }

  // ---- Work CRUD ----
  function addWork(folderId: string, data: { title: string; accentColor: AccentColor; labelUnread: string; labelRead: string; unit: string; sectionLabel: string; tags: string[]; genre?: string }) {
    const work: Work = { ...data, id: crypto.randomUUID(), sections: [], updatedAt: Date.now() };
    mutate((prev) => prev.map((f) => f.id !== folderId ? f : { ...f, works: [work, ...f.works], updatedAt: Date.now() }));
  }

  // タイトル・色などの編集（updatedAt更新あり）
  function editWork(folderId: string, workId: string, updates: Partial<Pick<Work, "title" | "accentColor" | "labelUnread" | "labelRead" | "unit" | "sectionLabel" | "tags" | "genre">>) {
    mutate((prev) => prev.map((f) => {
      if (f.id !== folderId) return f;
      const updatedWorks = f.works.map((w) => w.id !== workId ? w : { ...w, ...updates, updatedAt: Date.now() });
      const sorted = f.type === "read" ? updatedWorks : updatedWorks.sort((a, b) => b.updatedAt - a.updatedAt);
      return { ...f, updatedAt: Date.now(), works: sorted };
    }));
  }

  // 並び順のみ更新（updatedAt更新なし）
  function setWorkSortOrder(folderId: string, workId: string, sortOrder: import("./types").SortOrder) {
    mutate((prev) => prev.map((f) => {
      if (f.id !== folderId) return f;
      return { ...f, works: f.works.map((w) => w.id !== workId ? w : { ...w, sortOrder }) };
    }));
  }

  // フォルダ内全workの並び順を一括更新（updatedAt更新なし）
  function setFolderWorksSortOrder(folderId: string, sortOrder: import("./types").SortOrder) {
    mutate((prev) => prev.map((f) => {
      if (f.id !== folderId) return f;
      return { ...f, works: f.works.map((w) => ({ ...w, sortOrder })) };
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

  // セクション並び順のみ更新（updatedAt更新なし）
  function setSectionSortOrder(folderId: string, workId: string, sectionId: string, sortOrder: import("./types").SortOrder) {
    mutate((prev) => prev.map((f) => {
      if (f.id !== folderId) return f;
      return {
        ...f,
        works: f.works.map((w) => {
          if (w.id !== workId) return w;
          return { ...w, sections: w.sections.map((s) => s.id !== sectionId ? s : { ...s, sortOrder }) };
        }),
      };
    }));
  }

  // 全セクション並び順一括更新（updatedAt更新なし）
  function setAllSectionsSortOrder(folderId: string, workId: string, sortOrder: import("./types").SortOrder) {
    mutate((prev) => prev.map((f) => {
      if (f.id !== folderId) return f;
      return {
        ...f,
        works: f.works.map((w) => {
          if (w.id !== workId) return w;
          return { ...w, sections: w.sections.map((s) => ({ ...s, sortOrder })) };
        }),
      };
    }));
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
      {appMode === "stock" && (
        <StockScreen
          user={user}
          locked={locked}
          theme={theme}
          onToggleTheme={() => setTheme((v) => v === "dark" ? "light" : v === "light" ? "sepia" : "dark")}
          onToggleLock={() => setLocked((v) => !v)}
          onSignIn={signInWithGoogle}
          onSignOut={signOut}
          onSwitchToProgress={() => setAppMode("progress")}
        />
      )}
      {appMode === "vocab" && (
       <VocabScreen
         user={user}
         theme={theme}
         onToggleTheme={() => setTheme((v) => v === "dark" ? "light" : v === "light" ? "sepia" : "dark")}
         onSwitchToProgress={() => setAppMode("progress")}
         onSwitchToStock={() => setAppMode("stock")}
         startInCardMode={autoStartVocabCard}
         onStartInCardModeConsumed={() => setAutoStartVocabCard(false)}
        />
      )}
      {appMode === "progress" && view.screen === "folders" && (
        <FolderListScreen
          folders={folders}
          user={user}
          locked={locked}
          theme={theme}
          onToggleTheme={() => setTheme((v) => v === "dark" ? "light" : v === "light" ? "sepia" : "dark")}
          onToggleLock={() => setLocked((v) => !v)}
          onSignIn={signInWithGoogle}
          onSignOut={signOut}
          onSelect={(f) => {
            if (f.type === "read") {
              navigate({ screen: "genres", folderId: f.id });
            } else {
              navigate({ screen: "works", folderId: f.id });
            }
          }}
          onAdd={addFolder}
          onEdit={editFolder}
          onDelete={deleteFolder}
          onReorder={reorderFolders}
          onImport={importHandler}
          onSwitchToStock={() => setAppMode("stock")}
          onSwitchToVocab={() => setAppMode("vocab")}
          onMergeFolders={mergeFolders}
        />
      )}
      {appMode === "progress" && view.screen === "genres" && currentFolder && (
        <GenreListScreen
          folder={currentFolder}
          allFolders={folders}
          theme={theme}
          locked={locked}
          onBack={goBack}
          onSelectGenre={(genre) => navigate({ screen: "works", folderId: currentFolder.id, genre })}
          onAddGenre={(name) => addGenre(currentFolder.id, name)}
          onEditGenre={(oldName, newName) => editGenre(currentFolder.id, oldName, newName)}
          onDeleteGenre={(name) => deleteGenre(currentFolder.id, name)}
          onMergeGenres={(genreNames, targetFolderId) => mergeGenres(currentFolder.id, genreNames, targetFolderId)}
        />
      )}
      {appMode === "progress" && view.screen === "works" && currentFolder && (
        <WorkListScreen
          folder={currentFolder}
          locked={locked}
          theme={theme}
          genreFilter={view.genre}
          onToggleLock={() => setLocked((v) => !v)}
          onBack={goBack}
          onSelect={(w) => navigate({ screen: "detail", folderId: currentFolder.id, workId: w.id })}
          onToggleCompleted={(wId) => toggleWorkCompleted(currentFolder.id, wId)}
          onAdd={(data) => addWork(currentFolder.id, data)}
          onEdit={(wId, updates) => editWork(currentFolder.id, wId, updates)}
          onDelete={(wId) => deleteWork(currentFolder.id, wId)}
          onReorder={(newWorks) => reorderWorks(currentFolder.id, newWorks)}
          onSetSortOrder={(order) => setFolderWorksSortOrder(currentFolder.id, order)}
        />
      )}
      {appMode === "progress" && view.screen === "detail" && currentFolder && currentWork && (
        <WorkDetailScreen
          folder={currentFolder}
          work={currentWork}
          locked={locked}
          theme={theme}
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
          onSetSectionSortOrder={(sId, order) => setSectionSortOrder(currentFolder.id, currentWork.id, sId, order)}
          onSetAllSectionsSortOrder={(order) => setAllSectionsSortOrder(currentFolder.id, currentWork.id, order)}
        />
      )}
    </div>
  );
}
