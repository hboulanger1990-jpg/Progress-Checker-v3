import { useState, useRef, useEffect } from "react";
import type { Folder, Work } from "../types";
import { ACCENT_COLORS } from "../types";
import { calcWorkProgress } from "../storage";
import WorkModal from "../modals/WorkModal";

interface Props {
  folder: Folder;
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
}

export default function WorkListScreen({ folder, onBack, onSelect, onToggleCompleted, onAdd, onEdit, onDelete, onReorder }: Props) {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Work | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef({ x: 0, y: 0 });

  const isReadMode = folder.type === "read";
  const folderHex = ACCENT_COLORS[folder.accentColor].hex;
  const folderDefaults = {
    labelUnread: folder.defaultLabelUnread || "未完了",
    labelRead: folder.defaultLabelRead || "完了",
    unit: folder.defaultUnit || "",
  };

  useEffect(() => {
    const handler = (e: Event) => { e.stopImmediatePropagation(); };
    document.addEventListener("visibilitychange", handler, true);
    return () => document.removeEventListener("visibilitychange", handler, true);
  }, []);

  const allTags = Array.from(new Set(folder.works.flatMap((w) => w.tags ?? [])));

  const filtered = folder.works.filter((w) => {
    const matchText = w.title.toLowerCase().includes(search.toLowerCase());
    const matchTag = selectedTag ? (w.tags ?? []).includes(selectedTag) : true;
    return matchText && matchTag;
  });

  const sortedFiltered = sortMode
    ? folder.works
    : isReadMode
      ? filtered
      : [...filtered].sort((a, b) => {
          const pa = calcWorkProgress(a.sections).percent;
          const pb = calcWorkProgress(b.sections).percent;
          const rankA = pa === 100 ? 2 : pa === 0 ? 1 : 0;
          const rankB = pb === 100 ? 2 : pb === 0 ? 1 : 0;
          if (rankA !== rankB) return rankA - rankB;
          return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
        });

  function handleDelete(w: Work) {
    if (!window.confirm(`「${w.title}」を削除しますか？この操作は元に戻せません。`)) return;
    onDelete(w.id);
    setSelectedId(null);
  }

  function handlePressStart(id: string, touchX: number, touchY: number) {
    if (sortMode) return;
    touchStart.current = { x: touchX, y: touchY };
    longPressTimer.current = setTimeout(() => setSelectedId(id), 500);
  }
  function handlePressEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }
  function handleTouchStart(e: React.TouchEvent, id: string) {
    handlePressStart(id, e.touches[0].clientX, e.touches[0].clientY);
  }

  function calcDragOverIdx(clientY: number): number {
    const els = document.querySelectorAll("[data-work-id]");
    let found = 0;
    for (let i = 0; i < els.length; i++) {
      const rect = els[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (clientY < mid) { found = i; return found; }
      found = i + 1;
    }
    return found;
  }

  function applyReorder(fromId: string, overIdx: number) {
    const list = [...folder.works];
    const fromIdx = list.findIndex((w) => w.id === fromId);
    if (fromIdx === -1) return;
    const adjustedTo = overIdx > fromIdx ? overIdx - 1 : overIdx;
    if (adjustedTo === fromIdx) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(adjustedTo, 0, moved);
    onReorder(list);
  }

  function handleMouseDragStart(e: React.MouseEvent, id: string) {
    if (!sortMode) return;
    e.preventDefault();
    setDraggingId(id);
    const onMove = (me: MouseEvent) => {
      setDragOverIdx(calcDragOverIdx(me.clientY));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setDraggingId((cur) => {
        setDragOverIdx((over) => {
          if (cur && over !== null) applyReorder(cur, over);
          return null;
        });
        return null;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleTouchDragStart(e: React.TouchEvent, id: string) {
    if (!sortMode) return;
    e.stopPropagation();
    setDraggingId(id);
  }
  function handleTouchDragMove(e: React.TouchEvent) {
    if (!sortMode || !draggingId) return;
    e.preventDefault();
    setDragOverIdx(calcDragOverIdx(e.touches[0].clientY));
  }
  function handleTouchDragEnd() {
    if (draggingId && dragOverIdx !== null) applyReorder(draggingId, dragOverIdx);
    setDraggingId(null);
    setDragOverIdx(null);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }
  function handleDragLeave() {
    setIsDragOver(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const text = e.dataTransfer.getData("text/plain");
    if (!text) return;
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    [...lines].reverse().forEach((title) => {
      onAdd({
        title,
        accentColor: folder.accentColor,
        labelUnread: folderDefaults.labelUnread,
        labelRead: folderDefaults.labelRead,
        unit: folderDefaults.unit,
        sectionLabel: "",
        tags: [],
      });
    });
  }

  return (
    <div
      className="min-h-screen bg-[#1a1b26] flex flex-col relative"
      onTouchStart={(e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        handleTouchDragEnd();
        const dx = e.changedTouches[0].clientX - touchStart.current.x;
        const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y);
        if (!sortMode && touchStart.current.x < 40 && dx > 80 && dy < 80) onBack();
      }}
      onTouchMove={(e) => handleTouchDragMove(e)}
      onClick={() => setSelectedId(null)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-[#1a1b26]/80 backdrop-blur-sm" />
          <div
            className="relative border-2 border-dashed rounded-3xl px-10 py-8 text-center"
            style={{ borderColor: folderHex }}
          >
            <p className="text-4xl mb-2">📋</p>
            <p className="font-bold text-lg" style={{ color: folderHex }}>ここにドロップ</p>
            <p className="text-sm text-[#787c99] mt-1">1行につき1項目として追加します</p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-10 bg-[#1a1b26]/95 backdrop-blur-md border-b border-[#2a2d3e] px-4 pt-2 pb-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={onBack}
              className="shrink-0 flex items-center gap-1 text-sm font-medium active:scale-95 transition-transform py-1 pr-2"
              style={{ color: folderHex }}
            >
              <span className="text-base">←</span>
              <span>戻る</span>
            </button>
            <h1 className="flex-1 font-bold text-[#c0caf5] text-base truncate">{folder.title}</h1>
            <div className="flex items-center gap-2 shrink-0">
              {isReadMode && !sortMode && (
                <span className="text-xs text-[#787c99] bg-[#24283b] border border-[#3b4261] px-2 py-1 rounded-lg">
                  完了管理
                </span>
              )}
              <button
                onClick={() => { setSortMode((v) => !v); setSelectedId(null); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg border active:scale-95 transition-all text-sm"
                style={sortMode
                  ? { backgroundColor: folderHex, borderColor: folderHex, color: "#1a1b26" }
                  : { backgroundColor: "#24283b", borderColor: "#3b4261", color: "#787c99" }
                }
                title="並び替えモード"
              >↕</button>
            </div>
          </div>
          {!sortMode && (
            <>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#787c99] text-sm">🔍</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="項目を検索..."
                  className="w-full bg-[#24283b] text-[#c0caf5] border border-[#3b4261] rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#7aa2f7] transition-colors placeholder-[#4a5177]"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#787c99] text-lg leading-none">✕</button>
                )}
              </div>
              {allTags.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {allTags.map((tag) => {
                    const isActive = selectedTag === tag;
                    return (
                      <button
                        key={tag}
                        onClick={() => setSelectedTag(isActive ? null : tag)}
                        className="text-xs px-2.5 py-1 rounded-full border transition-all active:scale-95"
                        style={isActive
                          ? { backgroundColor: folderHex, color: "#1a1b26", borderColor: folderHex }
                          : { backgroundColor: "#24283b", color: "#787c99", borderColor: "#3b4261" }
                        }
                      >#{tag}</button>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {sortMode && (
            <p className="text-xs text-[#787c99] text-center py-1">ハンドルをドラッグして並び替え　↕ で終了</p>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-3 max-w-lg mx-auto w-full pb-32">
        {sortedFiltered.length === 0 ? (
          <div className="mt-20 text-center space-y-2">
            <p className="text-4xl">📖</p>
            <p className="text-[#787c99] text-sm">
              {search || selectedTag ? "条件に一致する項目はありません" : "項目がありません"}
            </p>
            {!search && !selectedTag && <p className="text-[#4a5177] text-xs">下のボタンから追加しましょう</p>}
          </div>
        ) : isReadMode ? (
          <div className="space-y-2">
            {sortMode && draggingId && dragOverIdx === 0 && (
              <div className="h-0.5 rounded-full" style={{ backgroundColor: folderHex }} />
            )}
            {sortedFiltered.map((work, workIndex) => {
              const hex = ACCENT_COLORS[work.accentColor].hex;
              const done = !!work.completed;
              const isSelected = selectedId === work.id;
              const isDraggingThis = draggingId === work.id;
              return (
                <div key={work.id}>
                  <div
                    data-work-id={work.id}
                    className={`relative transition-all duration-150 ${isDraggingThis ? "opacity-40 scale-[0.98]" : ""}`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (sortMode) return;
                        if (isSelected) { setSelectedId(null); return; }
                        onToggleCompleted(work.id);
                      }}
                      onMouseDown={(e) => { if (!sortMode) handlePressStart(work.id, 0, 0); else e.preventDefault(); }}
                      onMouseUp={handlePressEnd}
                      onMouseLeave={handlePressEnd}
                      onTouchStart={(e) => { if (!sortMode) handleTouchStart(e, work.id); }}
                      onTouchEnd={(e) => { handlePressEnd(); e.stopPropagation(); }}
                      onContextMenu={(e) => { if (!sortMode) { e.preventDefault(); setSelectedId(work.id); } }}
                      className="w-full rounded-2xl px-4 py-3 text-left active:scale-[0.98] transition-all duration-200 border flex items-center gap-3"
                      style={{
                        backgroundColor: done ? hex : "#24283b",
                        borderColor: isSelected ? "#7aa2f7" : done ? hex : "#3b4261",
                      }}
                    >
                      {sortMode && (
                        <span
                          className="text-lg cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
                          style={{ color: done ? "#1a1b2666" : "#4a5177" }}
                          onMouseDown={(e) => handleMouseDragStart(e, work.id)}
                          onTouchStart={(e) => { e.stopPropagation(); handleTouchDragStart(e, work.id); }}
                        >⠿</span>
                      )}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs transition-all"
                          style={{
                            borderColor: done ? "#1a1b26" : hex,
                            backgroundColor: done ? "#1a1b26" : "transparent",
                            color: done ? hex : "transparent",
                          }}
                        >✓</span>
                        <span
                          className="font-bold text-sm leading-tight truncate flex-1 min-w-0"
                          style={{ color: done ? "#1a1b26" : "#c0caf5" }}
                        >{work.title}</span>
                        {work.tags && work.tags.length > 0 && (
                          <div className="flex gap-1 shrink-0 flex-wrap justify-end max-w-[45%]">
                            {work.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap"
                                style={{
                                  backgroundColor: done ? "#1a1b2622" : `${hex}22`,
                                  color: done ? "#1a1b2699" : hex,
                                }}
                              >#{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                    {isSelected && !sortMode && (
                      <div className="absolute top-0 right-0 z-20 flex gap-2 p-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { setEditTarget(work); setSelectedId(null); }} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-[#24283b] border border-[#7aa2f7] text-[#7aa2f7] active:scale-95 transition-transform shadow-lg">✏️ 編集</button>
                        <button onClick={() => handleDelete(work)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-[#24283b] border border-[#f7768e] text-[#f7768e] active:scale-95 transition-transform shadow-lg">🗑 削除</button>
                      </div>
                    )}
                  </div>
                  {sortMode && draggingId && dragOverIdx === workIndex + 1 && (
                    <div className="h-0.5 rounded-full mt-2" style={{ backgroundColor: folderHex }} />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {sortMode && draggingId && dragOverIdx === 0 && (
              <div className="h-0.5 rounded-full" style={{ backgroundColor: folderHex }} />
            )}
            {sortedFiltered.map((work, workIndex) => {
              const { read, total, percent } = calcWorkProgress(work.sections);
              const hex = ACCENT_COLORS[work.accentColor].hex;
              const isSelected = selectedId === work.id;
              const isDraggingThis = draggingId === work.id;
              return (
                <div key={work.id}>
                  <div
                    data-work-id={work.id}
                    className={`relative transition-all duration-150 ${isDraggingThis ? "opacity-40 scale-[0.98]" : ""}`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (sortMode) return;
                        if (isSelected) { setSelectedId(null); return; }
                        onSelect(work);
                      }}
                      onMouseDown={(e) => { if (!sortMode) handlePressStart(work.id, 0, 0); else e.preventDefault(); }}
                      onMouseUp={handlePressEnd}
                      onMouseLeave={handlePressEnd}
                      onTouchStart={(e) => { if (!sortMode) handleTouchStart(e, work.id); }}
                      onTouchEnd={(e) => { handlePressEnd(); e.stopPropagation(); }}
                      onContextMenu={(e) => { if (!sortMode) { e.preventDefault(); setSelectedId(work.id); } }}
                      className={`w-full bg-[#24283b] border rounded-2xl px-4 py-3 text-left active:scale-[0.98] transition-all flex items-center gap-3 ${
                        isSelected ? "border-[#7aa2f7] ring-2 ring-[#7aa2f7]/30" : "border-[#3b4261]"
                      }`}
                    >
                      {sortMode && (
                        <span
                          className="text-[#4a5177] text-lg cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
                          onMouseDown={(e) => handleMouseDragStart(e, work.id)}
                          onTouchStart={(e) => { e.stopPropagation(); handleTouchDragStart(e, work.id); }}
                        >⠿</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-bold text-[#c0caf5] text-sm leading-tight truncate">{work.title}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-[#787c99]">{read}/{total}{work.unit}</span>
                            <span className="text-xs font-bold" style={{ color: hex }}>{percent}%</span>
                          </div>
                        </div>
                        <div className="h-1 bg-[#1a1b26] rounded-full overflow-hidden mb-1.5">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: hex }} />
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
                    {isSelected && !sortMode && (
                      <div className="absolute top-0 right-0 z-20 flex gap-2 p-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { setEditTarget(work); setSelectedId(null); }} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-[#24283b] border border-[#7aa2f7] text-[#7aa2f7] active:scale-95 transition-transform shadow-lg">✏️ 編集</button>
                        <button onClick={() => handleDelete(work)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-[#24283b] border border-[#f7768e] text-[#f7768e] active:scale-95 transition-transform shadow-lg">🗑 削除</button>
                      </div>
                    )}
                  </div>
                  {sortMode && draggingId && dragOverIdx === workIndex + 1 && (
                    <div className="h-0.5 rounded-full mt-2" style={{ backgroundColor: folderHex }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[#1a1b26] via-[#1a1b26]/90 to-transparent">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => setShowAdd(true)}
            className="w-full font-bold py-4 rounded-2xl text-base shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2 text-[#1a1b26]"
            style={{ backgroundColor: folderHex, boxShadow: `0 4px 24px ${folderHex}33` }}
          >
            <span className="text-xl leading-none">＋</span>
            <span>新しい項目を追加</span>
          </button>
        </div>
      </div>

      {showAdd && (
        <WorkModal
          mode="add"
          folderDefaults={folderDefaults}
          folderAccentColor={folder.accentColor}
          existingTags={allTags}
          onClose={() => setShowAdd(false)}
          onSave={(data) => { onAdd(data); setShowAdd(false); }}
        />
      )}
      {editTarget && (
        <WorkModal
          mode="edit"
          initial={editTarget}
          folderAccentColor={folder.accentColor}
          existingTags={allTags}
          onClose={() => setEditTarget(null)}
          onSave={(data) => { onEdit(editTarget.id, data); setEditTarget(null); }}
        />
      )}
    </div>
  );
}
