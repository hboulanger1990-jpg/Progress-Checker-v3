import { Pencil, Trash2, Search, ArrowLeft, X, Plus, Check, Grid2x2Check, ListChecks, LockKeyhole, LockKeyholeOpen, CheckSquare, Square, Tag, SlidersHorizontal, ArrowDownToLine } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Folder, Work, SortOrder } from "../types";
import { ACCENT_COLORS } from "../types";
import { calcWorkProgress } from "../storage";
import WorkModal from "../modals/WorkModal";

/** hex カラーにグレーを mix して彩度を落とした色を返す（ratio=0.0 で元色、1.0 でグレー） */
function mixWithGray(hex: string, theme: "dark" | "light" | "sepia", ratio: number): string {
  const gray = theme === "dark" ? 0x78 : 0xbe;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r + (gray - r) * ratio);
  const ng = Math.round(g + (gray - g) * ratio);
  const nb = Math.round(b + (gray - b) * ratio);
  return `rgb(${nr},${ng},${nb})`;
}

interface Props {
  folder: Folder;
  locked: boolean;
  theme: "dark" | "light" | "sepia";
  onToggleLock: () => void;
  onBack: () => void;
  onSelect: (w: Work) => void;
  onToggleCompleted: (workId: string) => void;
  onAdd: (data: {
    title: string;
    accentColor: import("../types").AccentColor;
    labelUnread: string;
    labelRead: string;
    unit: string;
    sectionLabel: string;
    tags: string[];
  }) => void;
  onEdit: (workId: string, updates: Partial<Pick<Work, "title" | "accentColor" | "labelUnread" | "labelRead" | "unit" | "sectionLabel" | "tags">>) => void;
  onDelete: (workId: string) => void;
  onReorder: (newWorks: Work[]) => void;
  onSetSortOrder: (order: SortOrder) => void;
}

const READ_SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "default", label: "登録順" },
  { value: "reverse", label: "登録逆順" },
  { value: "completed_first", label: "完了→未完了" },
  { value: "incomplete_first", label: "未完了→完了" },
  { value: "abc", label: "あいうえお順" },
];

const PROGRESS_SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "default", label: "登録順" },
  { value: "reverse", label: "登録逆順" },
  { value: "progress_asc", label: "進捗順（低→高）" },
  { value: "progress_desc", label: "進捗順（高→低）" },
];

export default function WorkListScreen({ folder, locked, theme, onToggleLock, onBack, onSelect, onToggleCompleted, onAdd, onEdit, onDelete, onReorder, onSetSortOrder }: Props) {
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Work | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveTargetId, setMoveTargetId] = useState<string | "top" | null>(null);
  const [showMoveMode, setShowMoveMode] = useState(false);
  const [showTagAction, setShowTagAction] = useState(false);
  const [tagActionInput, setTagActionInput] = useState("");

  const [sortOrder, setSortOrder] = useState<SortOrder>(() => folder.works[0]?.sortOrder ?? "default");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef({ x: 0, y: 0 });

  const isReadMode = folder.type === "read";
  const folderHex = ACCENT_COLORS[folder.accentColor].hex;
  const sortOptions = isReadMode ? READ_SORT_OPTIONS : PROGRESS_SORT_OPTIONS;
  const folderDefaults = {
    labelUnread: folder.defaultLabelUnread || "未完了",
    labelRead: folder.defaultLabelRead || "完了",
    unit: folder.defaultUnit || "",
  };
  const itemSize = folder.itemSize ?? "full";

  useEffect(() => {
    const handler = (e: Event) => { e.stopImmediatePropagation(); };
    document.addEventListener("visibilitychange", handler, true);
    return () => document.removeEventListener("visibilitychange", handler, true);
  }, []);

  useEffect(() => {
    if (locked) {
      setSelectMode(false);
      setSelectedIds(new Set());
      setSelectedId(null);
      setMoveTargetId(null);
      setShowMoveMode(false);
    }
  }, [locked]);

  useEffect(() => {
    if (!selectMode) {
      setMoveTargetId(null);
      setShowMoveMode(false);
      setShowTagAction(false);
    }
  }, [selectMode]);

  const allTags = Array.from(new Set(folder.works.flatMap((w) => w.tags ?? [])));

  const filtered = folder.works.filter((w) => {
    const matchText = w.title.toLowerCase().includes(search.toLowerCase());
    const matchTag = selectedTag ? (w.tags ?? []).includes(selectedTag) : true;
    return matchText && matchTag;
  });

  function applyWorkSortOrder(list: Work[]): Work[] {
    switch (sortOrder) {
      case "reverse": return [...list].reverse();
      case "completed_first": return [...list].sort((a, b) => (b.completed ? 1 : 0) - (a.completed ? 1 : 0));
      case "incomplete_first": return [...list].sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0));
      case "abc": return [...list].sort((a, b) => a.title.localeCompare(b.title, "ja"));
      case "progress_asc": return [...list].sort((a, b) => calcWorkProgress(a.sections).percent - calcWorkProgress(b.sections).percent);
      case "progress_desc": return [...list].sort((a, b) => calcWorkProgress(b.sections).percent - calcWorkProgress(a.sections).percent);
      default: return list;
    }
  }

  const sortedFiltered = sortOrder !== "default" ? applyWorkSortOrder(filtered) : filtered;

  function handleDelete(w: Work) {
    if (!window.confirm(`「${w.title}」を削除しますか？\nこの操作は元に戻せません。`)) return;
    onDelete(w.id);
    setSelectedId(null);
  }

  function handlePressStart(id: string) {
    if (locked || selectMode) return;
    longPressTimer.current = setTimeout(() => setSelectedId(id), 500);
  }
  function handlePressEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }
  function handleTouchStart(e: React.TouchEvent, id: string) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    handlePressStart(id);
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragOver(true); }
  function handleDragLeave() { setIsDragOver(false); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const text = e.dataTransfer.getData("text/plain");
    if (!text) return;
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    lines.forEach((title) => {
      onAdd({ title, accentColor: folder.accentColor, labelUnread: folderDefaults.labelUnread, labelRead: folderDefaults.labelRead, unit: folderDefaults.unit, sectionLabel: "", tags: [] });
    });
  }

  function toggleSelectId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setMoveTargetId(null);
    setShowMoveMode(false);
  }

  function executeMoveHere(targetId: string | "top") {
    if (selectedIds.size === 0) return;
    const list = [...folder.works];
    const selected = list.filter((w) => selectedIds.has(w.id));
    const notSelected = list.filter((w) => !selectedIds.has(w.id));

    let insertIdx: number;
    if (targetId === "top") {
      insertIdx = 0;
    } else {
      const targetIdx = notSelected.findIndex((w) => w.id === targetId);
      insertIdx = targetIdx === -1 ? notSelected.length : targetIdx + 1;
    }

    const result = [
      ...notSelected.slice(0, insertIdx),
      ...selected,
      ...notSelected.slice(insertIdx),
    ];

    onReorder(result);
    setMoveTargetId(null);
    if (!isReadMode && sortOrder !== "default") {
      setSortOrder("default");
      onSetSortOrder("default");
    }
  }

  function bulkAddTag(tag: string) {
    const t = tag.trim();
    if (!t) return;
    selectedIds.forEach((id) => {
      const w = folder.works.find((w) => w.id === id);
      if (!w) return;
      const tags = w.tags ?? [];
      if (!tags.includes(t)) onEdit(id, { tags: [...tags, t] });
    });
    setTagActionInput("");
    setShowTagAction(false);
  }

  function bulkRemoveTag(tag: string) {
    selectedIds.forEach((id) => {
      const w = folder.works.find((w) => w.id === id);
      if (!w) return;
      onEdit(id, { tags: (w.tags ?? []).filter((t) => t !== tag) });
    });
    setShowTagAction(false);
  }

  function bulkChangeTagColor(newHex: string) {
    const colorEntry = Object.entries(ACCENT_COLORS).find(([, v]) => v.hex === newHex);
    if (!colorEntry) return;
    const newAccentColor = colorEntry[0] as import("../types").AccentColor;
    selectedIds.forEach((id) => {
      onEdit(id, { accentColor: newAccentColor });
    });
  }

  const selectedWorks = folder.works.filter((w) => selectedIds.has(w.id));
  const commonTags = allTags.filter((tag) => selectedWorks.every((w) => (w.tags ?? []).includes(tag)));

  function handleSortOrderChange(order: SortOrder) {
    setSortOrder(order);
    setShowSortMenu(false);
    onSetSortOrder(order);
  }

  const showMoveButton = showMoveMode && selectedIds.size > 0;

  const readTitleClass = itemSize === "1"
    ? "line-clamp-1"
    : itemSize === "2"
    ? "line-clamp-2"
    : "whitespace-pre-wrap break-words";

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{ background: "var(--bg-gradient)" }}
      onTouchStart={(e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchStart.current.x;
        const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y);
        if (touchStart.current.x < 40 && dx > 80 && dy < 80) onBack();
      }}
      onClick={() => { setSelectedId(null); setShowSortMenu(false); }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ backgroundColor: "var(--bg-base)", opacity: 0.8 }} />
          <div className="relative border-2 border-dashed rounded-3xl px-10 py-8 text-center" style={{ borderColor: folderHex }}>
            <div className="flex justify-center"><Grid2x2Check size={40} /></div>
            <p className="font-bold text-lg" style={{ color: folderHex }}>ここにドロップ</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>1行につき1作品として追加します</p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-10 backdrop-blur-md border-b px-4 pt-2 pb-3"
        style={{ backgroundColor: "color-mix(in srgb, var(--bg-base) 95%, transparent)", borderColor: "var(--border-dim)" }}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="shrink-0 flex items-center gap-1 text-sm font-medium active:scale-95 transition-transform py-1 pr-2" style={{ color: folderHex }}>
              <ArrowLeft size={20} /><span>戻る</span>
            </button>
            <h1 className="flex-1 font-bold text-base truncate" style={{ color: theme === "sepia" ? "#c0392b" : "var(--text-primary)" }}>{folder.title}</h1>
            <div className="flex items-center gap-2 shrink-0">
              {/* ロックボタン */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg border active:scale-95 transition-all"
                style={locked
                  ? { backgroundColor: "#f7768e22", borderColor: "#f7768e", color: "#f7768e" }
                  : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-muted)" }
                }
                title={locked ? "ロック中（タップで解除）" : "ロック"}
              >{locked ? <LockKeyhole size={16} /> : <LockKeyholeOpen size={16} />}</button>

              {/* 選択ボタン */}
              {(() => {
                const isReverse = sortOrder === "reverse";
                const disabled = !selectMode && (locked || isReverse);
                return (
                  <button
                    onClick={() => {
                      if (disabled) return;
                      if (selectMode) {
                        setSelectMode(false);
                        setSelectedIds(new Set());
                        setMoveTargetId(null);
                      } else {
                        setSelectMode(true);
                        setSelectedId(null);
                      }
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border active:scale-95 transition-all"
                    style={selectMode
                      ? { backgroundColor: folderHex, borderColor: folderHex, color: "var(--bg-base)" }
                      : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: disabled ? "var(--locked-color)" : "var(--text-muted)" }
                    }
                    title={selectMode ? "選択モード終了" : isReverse ? "逆順中は並び替え不可" : "選択モード"}
                  >
                    {selectMode ? <Check size={16} /> : <CheckSquare size={16} />}
                  </button>
                );
              })()}

              {/* 並び替えボタン（常時表示、selectMode中は薄く無効） */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); if (!locked && !selectMode) setShowSortMenu((v) => !v); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border active:scale-95 transition-all"
                  style={selectMode
                    ? { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--locked-color)" }
                    : showSortMenu
                      ? { backgroundColor: folderHex, borderColor: folderHex, color: "var(--bg-base)" }
                      : sortOrder !== "default"
                        ? { backgroundColor: `${folderHex}22`, borderColor: folderHex, color: folderHex }
                        : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: locked ? "var(--locked-color)" : "var(--text-muted)" }
                  }
                  title="並び順"
                ><SlidersHorizontal size={16} /></button>
                {showSortMenu && (
                  <div className="absolute right-0 top-10 z-30 rounded-xl shadow-2xl overflow-hidden min-w-[160px] border"
                    style={{ backgroundColor: "var(--bg-overlay)", borderColor: "var(--border)" }}
                    onClick={(e) => e.stopPropagation()}>
                    {sortOptions.map((opt) => (
                      <button key={opt.value} onClick={() => handleSortOrderChange(opt.value)}
                        className="w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between gap-2"
                        style={{ color: sortOrder === opt.value ? folderHex : "var(--text-sub)", backgroundColor: sortOrder === opt.value ? `${folderHex}11` : "transparent" }}
                      >{opt.label}{sortOrder === opt.value && <Check size={14} />}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* 検索ボタン（RLのみ・常時表示、selectMode中は薄く無効） */}
              {isReadMode && (
                <button
                  onClick={(e) => { e.stopPropagation(); if (!selectMode) { setShowSearch((v) => !v); if (showSearch) setSearch(""); } }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border active:scale-95 transition-all"
                  style={selectMode
                    ? { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--locked-color)" }
                    : showSearch
                      ? { backgroundColor: folderHex, borderColor: folderHex, color: "var(--bg-base)" }
                      : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-muted)" }
                  }
                  title="検索"
                ><Search size={16} /></button>
              )}
            </div>
          </div>

          {!isReadMode && (
            <div style={selectMode ? { visibility: "hidden" } : {}}>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><Search size={20} /></span>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="作品を検索..."
                  className="w-full border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-colors"
                  style={{ backgroundColor: "var(--bg-input)", color: "var(--text-primary)", borderColor: "var(--border)" }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#7aa2f7"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                />
                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><X size={20} /></button>}
              </div>
              {allTags.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {allTags.map((tag) => {
                    const isActive = selectedTag === tag;
                    return (
                      <button key={tag} onClick={() => setSelectedTag(isActive ? null : tag)}
                        className="text-xs px-2.5 py-1 rounded-full border active:scale-95"
                        style={isActive ? { backgroundColor: folderHex, color: "var(--text-on-accent)", borderColor: folderHex } : { backgroundColor: "var(--bg-surface)", color: "var(--text-muted)", borderColor: "var(--border)" }}
                      >#{tag}</button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-3 max-w-lg mx-auto w-full pb-32">
        {isReadMode && (() => {
          const totalWorks = folder.works.length;
          const completedWorks = folder.works.filter((w) => w.completed).length;
          const pct = totalWorks === 0 ? 0 : Math.round((completedWorks / totalWorks) * 100);
          return (
            <div className="mb-3" style={selectMode ? { opacity: 0, pointerEvents: "none" } : {}}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>完了 {completedWorks} / {totalWorks}</span>
                <span className="text-xs font-bold" style={{ color: theme === "sepia" ? folderHex : mixWithGray(folderHex, theme, 0.3) }}>{pct}%</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-surface)" }}>
                <div className="h-full rounded-full transition-all duration-200" style={{ width: `${pct}%`, backgroundColor: theme === "sepia" ? folderHex : mixWithGray(folderHex, theme, 0.3) }} />
              </div>
            </div>
          );
        })()}

        {isReadMode && (
          <div style={selectMode ? { opacity: 0, pointerEvents: "none" } : {}}>
            {showSearch && (
              <div className="relative mb-2">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><Search size={20} /></span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="作品を検索..."
                  autoFocus
                  className="w-full border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-colors"
                  style={{ backgroundColor: "var(--bg-input)", color: "var(--text-primary)", borderColor: "var(--border)" }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#7aa2f7"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                />
                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><X size={20} /></button>}
              </div>
            )}
            {allTags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-2">
                {allTags.map((tag) => {
                  const isActive = selectedTag === tag;
                  return (
                    <button key={tag} onClick={() => setSelectedTag(isActive ? null : tag)}
                      className="text-xs px-2.5 py-1 rounded-full border active:scale-95"
                      style={isActive ? { backgroundColor: folderHex, color: "var(--text-on-accent)", borderColor: folderHex } : { backgroundColor: "var(--bg-surface)", color: "var(--text-muted)", borderColor: "var(--border)" }}
                    >#{tag}</button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {sortedFiltered.length === 0 ? (
          <div className="mt-20 text-center space-y-2">
            <div className="flex justify-center" style={{ color: "var(--text-muted)" }}><ListChecks size={40} /></div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{search || selectedTag ? "条件に一致する作品はありません" : "作品がありません"}</p>
            {!search && !selectedTag && <p className="text-xs" style={{ color: "var(--text-dim)" }}>下のボタンから追加しましょう</p>}
          </div>
        ) : isReadMode ? (
          <div className="space-y-2">
            {showMoveButton && (
              <MoveHereButton
                isTarget={moveTargetId === "top"}
                onToggle={() => setMoveTargetId((v) => v === "top" ? null : "top")}
                onExecute={() => executeMoveHere("top")}
                accentHex={folderHex}
              />
            )}
            {sortedFiltered.map((work) => {
              const hex = ACCENT_COLORS[work.accentColor].hex;
              const bgSepia = ACCENT_COLORS[work.accentColor].bgSepia;
              const done = !!work.completed;
              const isSelected = selectedId === work.id;
              const isChecked = selectedIds.has(work.id);
              return (
                <div key={work.id} className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectMode) { toggleSelectId(work.id); return; }
                      if (locked) return;
                      if (isSelected) { setSelectedId(null); return; }
                      onToggleCompleted(work.id);
                    }}
                    onMouseDown={() => { if (!selectMode && !locked) handlePressStart(work.id); }}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressEnd}
                    onTouchStart={(e) => { if (!selectMode && !locked) handleTouchStart(e, work.id); }}
                    onTouchEnd={(e) => { handlePressEnd(); e.stopPropagation(); }}
                    onContextMenu={(e) => { if (!selectMode && !locked) { e.preventDefault(); setSelectedId(work.id); } }}
                    className="w-full rounded-2xl px-4 py-3 text-left active:scale-[0.98] transition-all duration-200 border"
                    style={{
                      backgroundColor: done ? (theme === "sepia" ? bgSepia : mixWithGray(hex, theme, 0.3)) : "var(--bg-surface)",
                      borderColor: isChecked ? (done ? "#1a1b26" : (theme === "light" ? "#1a1b26" : "#7aa2f7")) : isSelected ? "#7aa2f7" : done ? (theme === "sepia" ? bgSepia : mixWithGray(hex, theme, 0.3)) : "var(--border)",
                      outline: isChecked ? (done ? "2px solid #1a1b2666" : (theme === "light" ? "2px solid #1a1b2644" : "2px solid #7aa2f744")) : "none"
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {selectMode && (
                        <span className="shrink-0 mt-0.5" style={{ color: isChecked ? (done ? "var(--text-on-accent)" : (theme === "light" ? "var(--text-primary)" : "#7aa2f7")) : theme === "light" ? "var(--text-primary)" : "var(--text-dim)" }}>
                          {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                        </span>
                      )}
                      <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all"
                        style={{ borderColor: done ? "var(--text-on-accent)" : hex, backgroundColor: done ? "var(--text-on-accent)" : "transparent", color: done ? hex : "transparent" }}
                      ><Check size={20} /></span>
                      {itemSize === "1" ? (
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="font-bold text-sm leading-snug line-clamp-1 flex-1 min-w-0"
                            style={{ color: done ? "var(--text-on-accent)" : "var(--text-primary)" }}>{work.title}</span>
                          {work.tags && work.tags.length > 0 && (
                            <div className="flex gap-1 shrink-0 flex-wrap justify-end max-w-[45%]">
                              {work.tags.map((tag) => (
                                <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap"
                                  style={{
                                    backgroundColor: done ? `${hex}33` : `${hex}22`,
                                    color: done ? "var(--text-on-accent)" : hex
                                  }}
                                >#{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0">
                          <span className={`font-bold text-sm leading-snug ${readTitleClass}`}
                            style={{ color: done ? "var(--text-on-accent)" : "var(--text-primary)" }}>{work.title}</span>
                          {work.tags && work.tags.length > 0 && (
                            <div className="flex gap-1 flex-wrap mt-1">
                              {work.tags.map((tag) => (
                                <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap"
                                  style={{
                                    backgroundColor: done ? `${hex}33` : `${hex}22`,
                                    color: done ? "var(--text-on-accent)" : hex
                                  }}
                                >#{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                  {isSelected && !selectMode && !locked && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-0 z-20 flex gap-2 p-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { setEditTarget(work); setSelectedId(null); }}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border active:scale-95 transition-transform shadow-lg"
                        style={{ backgroundColor: "var(--bg-surface)", borderColor: "#7aa2f7", color: "#7aa2f7" }}
                      ><Pencil size={16} /> 編集</button>
                      <button onClick={() => handleDelete(work)}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border active:scale-95 transition-transform shadow-lg"
                        style={{ backgroundColor: "var(--bg-surface)", borderColor: "#f7768e", color: "#f7768e" }}
                      ><Trash2 size={16} /> 削除</button>
                    </div>
                  )}
                  {showMoveButton && !isChecked && (
                    <MoveHereButton
                      isTarget={moveTargetId === work.id}
                      onToggle={() => setMoveTargetId((v) => v === work.id ? null : work.id)}
                      onExecute={() => executeMoveHere(work.id)}
                      accentHex={folderHex}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {showMoveButton && (
              <MoveHereButton
                isTarget={moveTargetId === "top"}
                onToggle={() => setMoveTargetId((v) => v === "top" ? null : "top")}
                onExecute={() => executeMoveHere("top")}
                accentHex={folderHex}
              />
            )}
            {sortedFiltered.map((work) => {
              const { read, total, percent } = calcWorkProgress(work.sections);
              const hex = ACCENT_COLORS[work.accentColor].hex;
              const bgSepia = ACCENT_COLORS[work.accentColor].bgSepia;
              const isSelected = selectedId === work.id;
              const isChecked = selectedIds.has(work.id);
              return (
                <div key={work.id} className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectMode) { toggleSelectId(work.id); return; }
                      if (isSelected) { setSelectedId(null); return; }
                      onSelect(work);
                    }}
                    onMouseDown={() => { if (!selectMode) handlePressStart(work.id); }}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressEnd}
                    onTouchStart={(e) => { if (!selectMode) handleTouchStart(e, work.id); }}
                    onTouchEnd={(e) => { handlePressEnd(); e.stopPropagation(); }}
                    onContextMenu={(e) => { if (!selectMode && !locked) { e.preventDefault(); setSelectedId(work.id); } }}
                    className={`w-full border rounded-2xl px-4 py-3 text-left active:scale-[0.98] transition-all flex items-center gap-3 ${isChecked || isSelected ? "border-[#7aa2f7] ring-2 ring-[#7aa2f7]/30" : ""}`}
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      borderColor: isChecked || isSelected ? "#7aa2f7" : "var(--border)"
                    }}
                  >
                    {selectMode && (
                      <span className="shrink-0" style={{ color: isChecked ? (theme === "light" ? "#1a1b26" : "#7aa2f7") : theme === "light" ? "var(--text-primary)" : "var(--text-dim)" }}>
                        {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-bold text-sm leading-tight truncate" style={{ color: "var(--text-primary)" }}>{work.title}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{read}/{total}{work.unit}</span>
                          <span className="text-xs font-bold" style={{ color: theme === "sepia" ? hex : mixWithGray(hex, theme, 0.3) }}>{percent}%</span>
                        </div>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden mb-1.5" style={{ backgroundColor: "var(--bg-base)" }}>
                        <div className="h-full rounded-full transition-all duration-200" style={{ width: `${percent}%`, backgroundColor: theme === "sepia" ? hex : mixWithGray(hex, theme, 0.3) }} />
                      </div>
                      {work.tags && work.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {work.tags.map((tag) => (
                            <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${hex}22`, color: hex }}>#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                  {isSelected && !selectMode && !locked && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-0 z-20 flex gap-2 p-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { setEditTarget(work); setSelectedId(null); }}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border active:scale-95 transition-transform shadow-lg"
                        style={{ backgroundColor: "var(--bg-surface)", borderColor: "#7aa2f7", color: "#7aa2f7" }}
                      ><Pencil size={16} /> 編集</button>
                      <button onClick={() => handleDelete(work)}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border active:scale-95 transition-transform shadow-lg"
                        style={{ backgroundColor: "var(--bg-surface)", borderColor: "#f7768e", color: "#f7768e" }}
                      ><Trash2 size={16} /> 削除</button>
                    </div>
                  )}
                  {showMoveButton && !isChecked && (
                    <MoveHereButton
                      isTarget={moveTargetId === work.id}
                      onToggle={() => setMoveTargetId((v) => v === work.id ? null : work.id)}
                      onExecute={() => executeMoveHere(work.id)}
                      accentHex={folderHex}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 選択モードアクションバー */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-6 pt-3"
          style={{ background: `linear-gradient(to top, var(--bg-base) 60%, transparent)` }}>
          <div className="max-w-lg mx-auto space-y-2">
            {showTagAction ? (
              <div className="rounded-2xl p-4 space-y-3 border"
                style={{ backgroundColor: "var(--bg-base)", borderColor: "var(--border)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>選択中の操作（{selectedIds.size}件）</p>
                <div className="flex gap-2">
                  <input value={tagActionInput} onChange={(e) => setTagActionInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); bulkAddTag(tagActionInput); } }}
                    placeholder="追加するタグを入力"
                    className="flex-1 border rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)", borderColor: "var(--border)" }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#7aa2f7"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                  />
                  <button onClick={() => bulkAddTag(tagActionInput)} className="px-3 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform" style={{ backgroundColor: folderHex, color: "var(--bg-base)" }}>追加</button>
                </div>
                {commonTags.length > 0 && (
                  <div>
                    <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>選択中の全作品についているタグ（タップで削除）</p>
                    <div className="flex flex-wrap gap-1.5">
                      {commonTags.map((tag) => (
                        <button key={tag} onClick={() => bulkRemoveTag(tag)} className="text-xs px-2.5 py-1 rounded-full border active:scale-95 transition-transform flex items-center gap-1"
                          style={{ borderColor: "#f7768e", color: "#f7768e", backgroundColor: "#f7768e11" }}>#{tag} <X size={10} /></button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>アクセントカラーを変更</p>
                  <div className="flex gap-2">
                    {Object.values(ACCENT_COLORS).map((c) => (
                      <button key={c.hex} onClick={() => bulkChangeTagColor(c.hex)}
                        className="w-6 h-6 rounded-full border-2 active:scale-90 transition-transform"
                        style={{ backgroundColor: c.hex, borderColor: "transparent" }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!window.confirm(`選択中の${selectedIds.size}件を削除しますか？`)) return;
                    selectedIds.forEach((id) => onDelete(id));
                    setSelectMode(false);
                    setSelectedIds(new Set());
                  }}
                  className="w-full py-2 rounded-xl border text-sm active:scale-95 transition-transform"
                  style={{ borderColor: "#f7768e", color: "#f7768e", backgroundColor: "#f7768e11" }}
                >選択中の作品を削除</button>
                <button onClick={() => setShowTagAction(false)} className="w-full py-2 rounded-xl border text-sm active:scale-95 transition-transform"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>閉じる</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setShowTagAction(true)} className="flex-1 py-3 rounded-2xl border text-sm font-medium active:scale-95 transition-transform flex items-center justify-center gap-2"
                  style={{ borderColor: "var(--border)", color: "var(--text-sub)", backgroundColor: "var(--bg-surface)" }}><Tag size={16} /> 選択中の操作</button>
                <button
                  onClick={() => { setShowMoveMode((v) => !v); setMoveTargetId(null); }}
                  disabled={selectedIds.size === 0}
                  className="flex-1 py-3 rounded-2xl border text-sm font-medium active:scale-95 transition-transform flex items-center justify-center gap-2"
                  style={showMoveMode
                    ? { backgroundColor: folderHex, borderColor: folderHex, color: "var(--bg-base)" }
                    : selectedIds.size === 0
                      ? { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--border)" }
                      : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-sub)" }
                  }
                ><ArrowDownToLine size={16} /> 移動</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 追加ボタン */}
      {!selectMode && !locked && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
          style={{ background: `linear-gradient(to top, var(--bg-base) 60%, transparent)` }}>
          <div className="max-w-lg mx-auto">
            <button onClick={() => setShowAdd(true)} className="w-full font-bold py-4 rounded-2xl text-base shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              style={{ backgroundColor: theme === "sepia" ? folderHex : mixWithGray(folderHex, theme, 0.3), color: "var(--bg-base)", boxShadow: `0 4px 24px ${folderHex}33` }}>
              <Plus size={20} /><span>新しい作品を追加</span>
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <WorkModal mode="add" folderDefaults={folderDefaults} folderAccentColor={folder.accentColor} existingTags={allTags}
          onClose={() => setShowAdd(false)} onSave={(data) => { onAdd(data); setShowAdd(false); }} />
      )}
      {editTarget && (
        <WorkModal mode="edit" initial={editTarget} folderAccentColor={folder.accentColor} existingTags={allTags}
          onClose={() => setEditTarget(null)} onSave={(data) => { onEdit(editTarget.id, data); setEditTarget(null); }} />
      )}
    </div>
  );
}

function MoveHereButton({
  isTarget, onToggle, onExecute, accentHex,
}: {
  isTarget: boolean;
  onToggle: () => void;
  onExecute: () => void;
  accentHex: string;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5 px-1">
      <div className="flex-1 h-px" style={{ backgroundColor: isTarget ? accentHex : "var(--border-dim)" }} />
      {isTarget ? (
        <button
          onClick={(e) => { e.stopPropagation(); onExecute(); }}
          className="w-7 h-7 flex items-center justify-center rounded-full active:scale-95 transition-all"
          style={{ backgroundColor: accentHex, color: "var(--bg-base)" }}
        >
          <ArrowDownToLine size={14} />
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="w-7 h-7 flex items-center justify-center rounded-full border active:scale-95 transition-all"
          style={{ borderColor: "var(--border)", color: "var(--text-dim)", backgroundColor: "var(--bg-base)" }}
        >
          <ArrowDownToLine size={14} />
        </button>
      )}
      <div className="flex-1 h-px" style={{ backgroundColor: isTarget ? accentHex : "var(--border-dim)" }} />
    </div>
  );
}
