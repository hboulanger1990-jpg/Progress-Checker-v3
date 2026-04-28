import { useState, useRef, useEffect, useCallback } from "react";
import type { Folder, Work, Section } from "../types";
import { ACCENT_COLORS } from "../types";
import { calcWorkProgress, calcSectionProgress } from "../storage";
import WorkModal from "../modals/WorkModal";
import SectionModal from "../modals/SectionModal";

interface Props {
  folder: Folder;
  work: Work;
  onBack: () => void;
  onEditWork: (updates: Partial<Pick<Work, "title" | "accentColor" | "labelUnread" | "labelRead" | "unit" | "sectionLabel">>) => void;
  onDeleteWork: () => void;
  onAddSection: (s: Omit<Section, "id" | "statuses">) => void;
  onEditSection: (sectionId: string, updates: Partial<Pick<Section, "label" | "startNum" | "endNum" | "mode" | "items">>) => void;
  onDeleteSection: (sectionId: string) => void;
  onToggleItem: (sectionId: string, num: number) => void;
  onReorderSections: (newSections: Section[]) => void;
  onReorderItems: (sectionId: string, newItems: string[], newStatuses: Section["statuses"]) => void;
}

type SectionModalState = null | { mode: "add" } | { mode: "edit"; section: Section };

const LAST_TOGGLE_PREFIX = "pc-lt-";

export default function WorkDetailScreen({
  folder, work, onBack, onEditWork, onDeleteWork,
  onAddSection, onEditSection, onDeleteSection, onToggleItem,
  onReorderSections, onReorderItems,
}: Props) {
  const [showWorkEdit, setShowWorkEdit] = useState(false);
  const [sectionModal, setSectionModal] = useState<SectionModalState>(null);
  const [textSearch, setTextSearch] = useState("");
  const [showTextSearch, setShowTextSearch] = useState(false);
  const [sortMode, setSortMode] = useState(false);

  // ドラッグ状態
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dragOverSectionIdx, setDragOverSectionIdx] = useState<number | null>(null); // インデックスに変更
  const [draggingItem, setDraggingItem] = useState<{ sectionId: string; idx: number } | null>(null);
  const [dragOverItemIdx, setDragOverItemIdx] = useState<number | null>(null);

  const touchStart = useRef({ x: 0, y: 0 });
  const justBecameVisible = useRef(false);
  // タッチドラッグ用のwindowリスナー管理
  const touchMoveHandler = useRef<((e: TouchEvent) => void) | null>(null);
  const touchEndHandler = useRef<((e: TouchEvent) => void) | null>(null);

  const accentHex = ACCENT_COLORS[work.accentColor].hex;
  const folderHex = ACCENT_COLORS[folder.accentColor].hex;
  const { read, total, percent } = calcWorkProgress(work.sections);
  const secLabel = work.sectionLabel || "セクション";
  const ltKey = `${LAST_TOGGLE_PREFIX}${work.id}`;

  const hasTextSections = work.sections.some((s) => s.mode === "text");

  useEffect(() => {
    const raw = localStorage.getItem(ltKey);
    if (!raw) return;
    try {
      const { sectionId, num } = JSON.parse(raw) as { sectionId: string; num: number };
      setTimeout(() => {
        const el = document.getElementById(`item-${sectionId}-${num}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        justBecameVisible.current = true;
        setTimeout(() => { justBecameVisible.current = false; }, 500);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // windowリスナーのクリーンアップ
  useEffect(() => {
    return () => {
      if (touchMoveHandler.current) window.removeEventListener("touchmove", touchMoveHandler.current);
      if (touchEndHandler.current) window.removeEventListener("touchend", touchEndHandler.current);
    };
  }, []);

  function handleTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (justBecameVisible.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y);
    if (touchStart.current.x < 40 && dx > 80 && dy < 80) onBack();
  }

  function handleDeleteSection(s: Section) {
    if (!window.confirm(`「${s.label}」を削除しますか？`)) return;
    onDeleteSection(s.id);
  }

  function handleToggle(sectionId: string, num: number) {
    onToggleItem(sectionId, num);
    localStorage.setItem(ltKey, JSON.stringify({ sectionId, num }));
    requestAnimationFrame(() => {
      const el = document.getElementById(`item-${sectionId}-${num}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function getAddSectionDefaults() {
    const n = work.sections.length;
    if (n === 0) return { label: "1", startNum: 1, endNum: undefined };
    const last = work.sections[n - 1];
    const startNum = last.endNum + 1;
    const lastCount = last.endNum - last.startNum + 1;
    return { label: `${n + 1}`, startNum, endNum: startNum + lastCount - 1 };
  }

  // ---- セクションドラッグ（ハンドル直接タッチ、windowリスナー方式） ----
  function startSectionDrag(sectionId: string) {
    setDraggingSectionId(sectionId);

    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      const y = e.touches[0].clientY;
      const els = document.querySelectorAll("[data-section-id]");
      let found: number | null = null;
      for (let i = 0; i < els.length; i++) {
        const rect = els[i].getBoundingClientRect();
        // アイテムの上半分なら i、下半分なら i+1 の手前（線をその間に引く）
        const mid = rect.top + rect.height / 2;
        if (y < mid) { found = i; break; }
        found = i + 1;
      }
      setDragOverSectionIdx(found);
    };

    const onEnd = () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      touchMoveHandler.current = null;
      touchEndHandler.current = null;

      setDraggingSectionId((cur) => {
        setDragOverSectionIdx((overIdx) => {
          if (cur !== null && overIdx !== null) {
            const sections = [...work.sections];
            const fromIdx = sections.findIndex((s) => s.id === cur);
            if (fromIdx !== -1) {
              const adjustedTo = overIdx > fromIdx ? overIdx - 1 : overIdx;
              if (adjustedTo !== fromIdx) {
                const [moved] = sections.splice(fromIdx, 1);
                sections.splice(adjustedTo, 0, moved);
                onReorderSections(sections);
              }
            }
          }
          return null;
        });
        return null;
      });
    };

    if (touchMoveHandler.current) window.removeEventListener("touchmove", touchMoveHandler.current);
    if (touchEndHandler.current) window.removeEventListener("touchend", touchEndHandler.current);
    touchMoveHandler.current = onMove;
    touchEndHandler.current = onEnd;
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  }

  // ---- アイテムドラッグ（ハンドル直接タッチ、windowリスナー方式） ----
  function startItemDrag(sectionId: string, idx: number) {
    setDraggingItem({ sectionId, idx });

    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      const y = e.touches[0].clientY;
      const els = document.querySelectorAll(`[data-item-section="${sectionId}"]`);
      let found: number | null = null;
      for (let i = 0; i < els.length; i++) {
        const rect = els[i].getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (y < mid) { found = i; break; }
        found = i + 1;
      }
      setDragOverItemIdx(found);
    };

    const onEnd = () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      touchMoveHandler.current = null;
      touchEndHandler.current = null;

      setDraggingItem((di) => {
        setDragOverItemIdx((overIdx) => {
          if (di && di.sectionId === sectionId && overIdx !== null) {
            const section = work.sections.find((s) => s.id === sectionId);
            if (section) {
              const adjustedTo = overIdx > di.idx ? overIdx - 1 : overIdx;
              if (adjustedTo !== di.idx) {
                const items = [...(section.items ?? [])];
                const [movedItem] = items.splice(di.idx, 1);
                items.splice(adjustedTo, 0, movedItem);
                const newStatuses: Section["statuses"] = {};
                items.forEach((it, newIdx) => {
                  const origIdx = section.items!.indexOf(it);
                  if (section.statuses[section.startNum + origIdx]) {
                    newStatuses[section.startNum + newIdx] = "read";
                  }
                });
                onReorderItems(sectionId, items, newStatuses);
              }
            }
          }
          return null;
        });
        return null;
      });
    };

    if (touchMoveHandler.current) window.removeEventListener("touchmove", touchMoveHandler.current);
    if (touchEndHandler.current) window.removeEventListener("touchend", touchEndHandler.current);
    touchMoveHandler.current = onMove;
    touchEndHandler.current = onEnd;
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  }

  const filteredSections = useCallback(() => {
    if (!textSearch.trim()) return work.sections;
    return work.sections.map((s) => {
      if (s.mode !== "text" || !s.items) return s;
      const filtered = s.items.filter((item) =>
        item.toLowerCase().includes(textSearch.toLowerCase())
      );
      return { ...s, _filteredItems: filtered };
    });
  }, [work.sections, textSearch]);

  return (
    <div
      className="min-h-screen bg-[#1a1b26] flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <header className="sticky top-0 z-10 bg-[#1a1b26]/95 backdrop-blur-md border-b border-[#2a2d3e] px-4 py-3">
        <div className="max-w-lg mx-auto relative">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="shrink-0 flex items-center gap-1 text-sm font-medium active:scale-95 transition-transform py-1 pr-2"
              style={{ color: folderHex }}
            >
              <span className="text-base">←</span>
              <span>戻る</span>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-[#c0caf5] text-base leading-tight truncate">{work.title}</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { setSortMode((v) => !v); setShowTextSearch(false); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg border active:scale-95 transition-all text-sm"
                style={sortMode
                  ? { backgroundColor: accentHex, borderColor: accentHex, color: "#1a1b26" }
                  : { backgroundColor: "#24283b", borderColor: "#3b4261", color: "#787c99" }
                }
                title="並び替えモード"
              >↕</button>
              {hasTextSections && !sortMode && (
                <button
                  onClick={() => setShowTextSearch((v) => !v)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#24283b] border border-[#3b4261] active:scale-95 transition-transform text-sm"
                  style={{ color: showTextSearch ? accentHex : "#787c99", borderColor: showTextSearch ? accentHex : "#3b4261" }}
                  aria-label="テキスト検索"
                >🔍</button>
              )}
              <button
                onClick={() => setShowWorkEdit(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#24283b] border border-[#3b4261] text-[#787c99] active:scale-95 transition-transform text-sm"
              >⚙️</button>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-3 max-w-lg mx-auto w-full">
        <div className="bg-[#24283b] border border-[#3b4261] rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-4 text-xs text-[#787c99]">
              <span>
                <span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ backgroundColor: accentHex }} />
                {work.labelRead} {read}
              </span>
              <span className="text-[#4a5177]">/ {total}{work.unit}</span>
            </div>
            <span className="text-xs font-bold" style={{ color: accentHex }}>{percent}%</span>
          </div>
          <div className="h-2 bg-[#1a1b26] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: accentHex }} />
          </div>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto w-full mb-2">
        <div className="flex gap-4 text-xs text-[#787c99]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-5 rounded border border-[#3b4261] bg-[#24283b]" />
            {work.labelUnread}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-5 rounded border" style={{ backgroundColor: accentHex, borderColor: accentHex }} />
            {work.labelRead}
          </span>
        </div>
      </div>

      {sortMode && (
        <div className="px-4 py-1.5 max-w-lg mx-auto w-full">
          <p className="text-xs text-[#787c99] text-center">ハンドルをドラッグして並び替え　↕ で終了</p>
        </div>
      )}

      {hasTextSections && showTextSearch && !sortMode && (
        <div className="px-4 mb-2 max-w-lg mx-auto w-full">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#787c99] text-sm">🔍</span>
            <input
              value={textSearch}
              onChange={(e) => setTextSearch(e.target.value)}
              placeholder="テキスト項目を検索..."
              className="w-full bg-[#24283b] text-[#c0caf5] border border-[#3b4261] rounded-xl pl-9 pr-8 py-2.5 text-sm outline-none focus:border-[#7aa2f7] transition-colors placeholder-[#4a5177]"
            />
            {textSearch && (
              <button onClick={() => setTextSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#787c99] text-lg leading-none">✕</button>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 px-3 max-w-lg mx-auto w-full pb-6">
        {work.sections.length === 0 ? (
          <div className="mt-12 text-center space-y-2">
            <p className="text-3xl">📋</p>
            <p className="text-[#787c99] text-sm">{secLabel}がありません</p>
            <button
              onClick={() => setSectionModal({ mode: "add" })}
              className="mt-2 px-6 py-2.5 rounded-xl text-sm font-bold text-[#1a1b26] active:scale-95 transition-transform"
              style={{ backgroundColor: accentHex }}
            >
              ＋ {secLabel}を追加
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* セクションドロップ先インジケーター（先頭） */}
            {sortMode && draggingSectionId && dragOverSectionIdx === 0 && (
              <div className="h-0.5 rounded-full mx-1" style={{ backgroundColor: accentHex }} />
            )}
            {filteredSections().map((section, sectionIndex) => {
              const sectionWithFilter = section as Section & { _filteredItems?: string[] };
              const displayItems = sectionWithFilter._filteredItems ?? section.items ?? [];
              const { read: sRead, total: sTotal } = calcSectionProgress(section);
              const isDraggingThis = draggingSectionId === section.id;

              return (
                <div key={section.id}>
                  <div
                    data-section-id={section.id}
                    className={`transition-all duration-150 ${isDraggingThis ? "opacity-40 scale-[0.98]" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {sortMode && (
                          <button
                            className="shrink-0 w-7 h-7 flex items-center justify-center text-[#4a5177] cursor-grab active:cursor-grabbing touch-none select-none"
                            onTouchStart={(e) => { e.stopPropagation(); startSectionDrag(section.id); }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setDraggingSectionId(section.id);
                              const onMove = (me: MouseEvent) => {
                                const els = document.querySelectorAll("[data-section-id]");
                                let found: number | null = null;
                                for (let i = 0; i < els.length; i++) {
                                  const rect = els[i].getBoundingClientRect();
                                  const mid = rect.top + rect.height / 2;
                                  if (me.clientY < mid) { found = i; break; }
                                  found = i + 1;
                                }
                                setDragOverSectionIdx(found);
                              };
                              const onUp = () => {
                                window.removeEventListener("mousemove", onMove);
                                window.removeEventListener("mouseup", onUp);
                                setDraggingSectionId((cur) => {
                                  setDragOverSectionIdx((overIdx) => {
                                    if (cur !== null && overIdx !== null) {
                                      const sections = [...work.sections];
                                      const fromIdx = sections.findIndex((s) => s.id === cur);
                                      if (fromIdx !== -1) {
                                        const adjustedTo = overIdx > fromIdx ? overIdx - 1 : overIdx;
                                        if (adjustedTo !== fromIdx) {
                                          const [moved] = sections.splice(fromIdx, 1);
                                          sections.splice(adjustedTo, 0, moved);
                                          onReorderSections(sections);
                                        }
                                      }
                                    }
                                    return null;
                                  });
                                  return null;
                                });
                              };
                              window.addEventListener("mousemove", onMove);
                              window.addEventListener("mouseup", onUp);
                            }}
                            aria-label="セクションを並び替え"
                          >⠿</button>
                        )}
                        <div className="min-w-0">
                          <span className="font-bold text-[#c0caf5] text-sm">{section.label}</span>
                          <span className="text-xs text-[#787c99] ml-2">
                            {section.mode === "text"
                              ? `${sTotal}${work.unit || "項目"} · ${work.labelRead} ${sRead}/${sTotal}`
                              : `${section.startNum}〜${section.endNum}${work.unit} · ${work.labelRead} ${sRead}/${sTotal}${work.unit}`
                            }
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSectionModal({ mode: "edit", section })}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#787c99] text-xs active:scale-95 transition-transform"
                        >⚙️</button>
                        <button
                          onClick={() => handleDeleteSection(section)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#f7768e] text-xs active:scale-95 transition-transform"
                        >🗑</button>
                      </div>
                    </div>

                    {section.mode === "text" && section.items ? (
                      <div className="space-y-1.5">
                        {/* アイテムドロップ先インジケーター（先頭） */}
                        {sortMode && draggingItem?.sectionId === section.id && dragOverItemIdx === 0 && (
                          <div className="h-0.5 rounded-full mx-1" style={{ backgroundColor: accentHex }} />
                        )}
                        {displayItems.map((itemLabel, idx) => {
                          const realIdx = section.items!.indexOf(itemLabel);
                          const num = section.startNum + (textSearch ? realIdx : idx);
                          const isRead = !!section.statuses[num];
                          const isDraggingThisItem = draggingItem?.sectionId === section.id && draggingItem?.idx === idx;
                          return (
                            <div key={`${section.id}-${idx}`}>
                              <button
                                id={`item-${section.id}-${num}`}
                                data-item-section={section.id}
                                onClick={() => !sortMode && handleToggle(section.id, num)}
                                onTouchStart={(e) => { e.stopPropagation(); }}
                                className={`w-full border rounded-xl px-4 py-3 text-left text-sm font-medium select-none touch-manipulation transition-all duration-100 ${isDraggingThisItem ? "opacity-40" : ""} ${sortMode ? "" : "active:scale-[0.98]"}`}
                                style={
                                  isRead
                                    ? { backgroundColor: accentHex, color: "#1a1b26", borderColor: accentHex }
                                    : { backgroundColor: "#24283b", color: "#c0caf5", borderColor: "#3b4261" }
                                }
                              >
                                <div className="flex items-center gap-2">
                                  {sortMode && (
                                    <span
                                      className="text-[#4a5177] text-base cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
                                      onTouchStart={(e) => { e.stopPropagation(); startItemDrag(section.id, idx); }}
                                      onMouseDown={(e) => {
                                        if (!sortMode) return;
                                        e.stopPropagation();
                                        setDraggingItem({ sectionId: section.id, idx });
                                        const onMove = (me: MouseEvent) => {
                                          const els = document.querySelectorAll(`[data-item-section="${section.id}"]`);
                                          let found: number | null = null;
                                          for (let i = 0; i < els.length; i++) {
                                            const rect = els[i].getBoundingClientRect();
                                            const mid = rect.top + rect.height / 2;
                                            if (me.clientY < mid) { found = i; break; }
                                            found = i + 1;
                                          }
                                          setDragOverItemIdx(found);
                                        };
                                        const onUp = () => {
                                          window.removeEventListener("mousemove", onMove);
                                          window.removeEventListener("mouseup", onUp);
                                          setDraggingItem((di) => {
                                            setDragOverItemIdx((doi) => {
                                              if (di && doi !== null) {
                                                const section2 = work.sections.find((s) => s.id === section.id);
                                                if (section2) {
                                                  const adjustedTo = doi > di.idx ? doi - 1 : doi;
                                                  if (adjustedTo !== di.idx) {
                                                    const items = [...(section2.items ?? [])];
                                                    const [movedItem] = items.splice(di.idx, 1);
                                                    items.splice(adjustedTo, 0, movedItem);
                                                    const newStatuses: Section["statuses"] = {};
                                                    items.forEach((it, newIdx) => {
                                                      const origIdx = section2.items!.indexOf(it);
                                                      if (section2.statuses[section2.startNum + origIdx]) {
                                                        newStatuses[section2.startNum + newIdx] = "read";
                                                      }
                                                    });
                                                    onReorderItems(section.id, items, newStatuses);
                                                  }
                                                }
                                              }
                                              return null;
                                            });
                                            return null;
                                          });
                                        };
                                        window.addEventListener("mousemove", onMove);
                                        window.addEventListener("mouseup", onUp);
                                      }}
                                    >⠿</span>
                                  )}
                                  <span className="whitespace-pre-wrap break-words flex-1">{itemLabel}</span>
                                </div>
                              </button>
                              {/* アイテム間のドロップ先インジケーター */}
                              {sortMode && draggingItem?.sectionId === section.id && dragOverItemIdx === idx + 1 && (
                                <div className="h-0.5 rounded-full mx-1 mt-1.5" style={{ backgroundColor: accentHex }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                        {Array.from(
                          { length: section.endNum - section.startNum + 1 },
                          (_, i) => section.startNum + i
                        ).map((num) => {
                          const isRead = !!section.statuses[num];
                          return (
                            <button
                              key={num}
                              id={`item-${section.id}-${num}`}
                              onClick={() => handleToggle(section.id, num)}
                              className="border rounded-xl aspect-square flex items-center justify-center font-bold text-sm select-none touch-manipulation active:scale-90 transition-all duration-100"
                              style={
                                isRead
                                  ? { backgroundColor: accentHex, color: "#1a1b26", borderColor: accentHex }
                                  : { backgroundColor: "#24283b", color: "#4a5177", borderColor: "#3b4261" }
                              }
                              aria-label={`${num}${work.unit}`}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* セクション間のドロップ先インジケーター */}
                  {sortMode && draggingSectionId && dragOverSectionIdx === sectionIndex + 1 && (
                    <div className="h-0.5 rounded-full mx-1 mt-5" style={{ backgroundColor: accentHex }} />
                  )}
                </div>
              );
            })}

            <button
              onClick={() => setSectionModal({ mode: "add" })}
              className="w-full py-3 rounded-xl border border-dashed border-[#3b4261] text-[#787c99] text-sm active:scale-95 transition-transform flex items-center justify-center gap-1.5"
            >
              <span>＋</span>
              <span>{secLabel}を追加</span>
            </button>
          </div>
        )}
      </main>

      {showWorkEdit && (
        <WorkModal
          mode="edit"
          initial={work}
          onClose={() => setShowWorkEdit(false)}
          onSave={(data) => { onEditWork(data); setShowWorkEdit(false); }}
        />
      )}
      {sectionModal?.mode === "add" && (
        <SectionModal
          mode="add"
          labelName={secLabel}
          workId={work.id}
          defaults={getAddSectionDefaults()}
          onClose={() => setSectionModal(null)}
          onSave={(label, startNum, endNum, sectionMode, items) => {
            onAddSection({ label, startNum, endNum, mode: sectionMode, items });
            setSectionModal(null);
          }}
        />
      )}
      {sectionModal?.mode === "edit" && (
        <SectionModal
          mode="edit"
          labelName={secLabel}
          workId={work.id}
          initial={sectionModal.section}
          onClose={() => setSectionModal(null)}
          onSave={(label, startNum, endNum, sectionMode, items) => {
            onEditSection(sectionModal.section.id, { label, startNum, endNum, mode: sectionMode, items });
            setSectionModal(null);
          }}
        />
      )}
    </div>
  );
}
