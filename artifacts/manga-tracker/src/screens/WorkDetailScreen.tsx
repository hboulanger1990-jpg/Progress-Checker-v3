import { Settings, Trash2, Search, ArrowLeft, X, Plus, GripVertical, Grid2x2Check, LockKeyhole, LockKeyholeOpen, SlidersHorizontal, Check, CheckSquare, Square, ArrowDownToLine } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import type { Folder, Work, Section, SortOrder } from "../types";
import { ACCENT_COLORS } from "../types";
import { calcWorkProgress, calcSectionProgress } from "../storage";
import WorkModal from "../modals/WorkModal";
import SectionModal from "../modals/SectionModal";

interface Props {
  folder: Folder;
  work: Work;
  locked: boolean;
  onToggleLock: () => void;
  onBack: () => void;
  onEditWork: (updates: Partial<Pick<Work, "title" | "accentColor" | "labelUnread" | "labelRead" | "unit" | "sectionLabel">>) => void;
  onDeleteWork: () => void;
  onAddSection: (s: Omit<Section, "id" | "statuses">) => void;
  onEditSection: (sectionId: string, updates: Partial<Pick<Section, "label" | "startNum" | "endNum" | "mode" | "items" | "sortOrder">>) => void;
  onDeleteSection: (sectionId: string) => void;
  onToggleItem: (sectionId: string, num: number) => void;
  onReorderSections: (newSections: Section[]) => void;
  onReorderItems: (sectionId: string, newItems: string[], newStatuses: Section["statuses"]) => void;
  onSetSectionSortOrder: (sectionId: string, order: SortOrder) => void;
  onSetAllSectionsSortOrder: (order: SortOrder) => void;
}

type SectionModalState = null | { mode: "add" } | { mode: "edit"; section: Section };

const LAST_TOGGLE_PREFIX = "pc-lt-";

const SECTION_SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "default", label: "登録順" },
  { value: "reverse", label: "登録逆順" },
];

const ITEM_SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "default", label: "登録順" },
  { value: "reverse", label: "登録逆順" },
  { value: "abc", label: "あいうえお順" },
];

export default function WorkDetailScreen({
  folder, work, locked, onToggleLock, onBack, onEditWork, onDeleteWork,
  onAddSection, onEditSection, onDeleteSection, onToggleItem,
  onReorderSections, onReorderItems, onSetSectionSortOrder, onSetAllSectionsSortOrder,
}: Props) {
  const [showWorkEdit, setShowWorkEdit] = useState(false);
  const [sectionModal, setSectionModal] = useState<SectionModalState>(null);
  const [textSearch, setTextSearch] = useState("");
  const [showTextSearch, setShowTextSearch] = useState(false);

  const [sectionSortOrder, setSectionSortOrder] = useState<SortOrder>(() => work.sections[0]?.sortOrder ?? "default");
  const [showSectionSortMenu, setShowSectionSortMenu] = useState(false);
  const [showItemSortMenu, setShowItemSortMenu] = useState<string | null>(null);

  // セクション選択モード
  const [sectionSelectMode, setSectionSelectMode] = useState(false);
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set());
  const [sectionMoveTargetId, setSectionMoveTargetId] = useState<string | "top" | null>(null);

  // テキスト項目選択モード（sectionId -> Set<idx>）
  const [itemSelectMode, setItemSelectMode] = useState<string | null>(null); // sectionId or null
  const [selectedItemIdxs, setSelectedItemIdxs] = useState<Set<number>>(new Set());
  const [itemMoveTargetIdx, setItemMoveTargetIdx] = useState<number | "top" | null>(null);

  // セクションドラッグ（通常モード）
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dragOverSectionIdx, setDragOverSectionIdx] = useState<number | null>(null);

  const touchStart = useRef({ x: 0, y: 0 });
  const justBecameVisible = useRef(false);
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
      setTimeout(() => { document.getElementById(`item-${sectionId}-${num}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 200);
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

  useEffect(() => {
    return () => {
      if (touchMoveHandler.current) window.removeEventListener("touchmove", touchMoveHandler.current);
      if (touchEndHandler.current) window.removeEventListener("touchend", touchEndHandler.current);
    };
  }, []);

  useEffect(() => {
    if (locked) {
      setSectionSelectMode(false);
      setSelectedSectionIds(new Set());
      setSectionMoveTargetId(null);
      setItemSelectMode(null);
      setSelectedItemIdxs(new Set());
      setItemMoveTargetIdx(null);
    }
  }, [locked]);

  useEffect(() => {
    if (!sectionSelectMode) {
      setSectionMoveTargetId(null);
    }
  }, [sectionSelectMode]);

  useEffect(() => {
    if (!itemSelectMode) {
      setItemMoveTargetIdx(null);
      setSelectedItemIdxs(new Set());
    }
  }, [itemSelectMode]);

  function handleTouchStart(e: React.TouchEvent) { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
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
    if (locked) return;
    onToggleItem(sectionId, num);
    localStorage.setItem(ltKey, JSON.stringify({ sectionId, num }));
    requestAnimationFrame(() => { document.getElementById(`item-${sectionId}-${num}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); });
  }

  function getAddSectionDefaults() {
    const n = work.sections.length;
    if (n === 0) return { label: "1", startNum: 1, endNum: undefined };
    const last = work.sections[n - 1];
    const startNum = last.endNum + 1;
    return { label: `${n + 1}`, startNum, endNum: startNum + (last.endNum - last.startNum) };
  }

  function applySectionSort(sections: Section[]): Section[] {
    if (sectionSortOrder === "reverse") return [...sections].reverse();
    return sections;
  }

  function applyItemSort(items: string[], section: Section): string[] {
    const order = section.sortOrder ?? "default";
    if (order === "reverse") return [...items].reverse();
    if (order === "abc") return [...items].sort((a, b) => a.localeCompare(b, "ja"));
    return items;
  }

  function handleSectionSortChange(order: SortOrder) {
    setSectionSortOrder(order);
    setShowSectionSortMenu(false);
    onSetAllSectionsSortOrder(order);
  }

  function handleItemSortChange(sectionId: string, order: SortOrder) {
    onSetSectionSortOrder(sectionId, order);
    setShowItemSortMenu(null);
  }

  // ---- セクション選択モード ----
  function toggleSectionSelect(id: string) {
    setSelectedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setSectionMoveTargetId(null);
  }

  function executeSectionMoveHere(targetId: string | "top") {
    if (selectedSectionIds.size === 0) return;
    const sections = applySectionSort(work.sections);
    const selected = sections.filter((s) => selectedSectionIds.has(s.id));
    const notSelected = sections.filter((s) => !selectedSectionIds.has(s.id));

    let insertIdx: number;
    if (targetId === "top") {
      insertIdx = 0;
    } else {
      const targetIdx = notSelected.findIndex((s) => s.id === targetId);
      insertIdx = targetIdx === -1 ? notSelected.length : targetIdx + 1;
    }

    const result = [
      ...notSelected.slice(0, insertIdx),
      ...selected,
      ...notSelected.slice(insertIdx),
    ];
    onReorderSections(result);
    setSectionMoveTargetId(null);
  }

  // ---- テキスト項目選択モード ----
  function toggleItemSelect(idx: number) {
    setSelectedItemIdxs((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
    setItemMoveTargetIdx(null);
  }

  function executeItemMoveHere(sectionId: string, displayItems: string[], targetIdx: number | "top") {
    if (selectedItemIdxs.size === 0) return;
    const section = work.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const selected = displayItems.filter((_, i) => selectedItemIdxs.has(i));
    const notSelected = displayItems.filter((_, i) => !selectedItemIdxs.has(i));

    let insertIdx: number;
    if (targetIdx === "top") {
      insertIdx = 0;
    } else {
      // targetIdx is index in displayItems (not selected ones filtered)
      const notSelectedTargetIdx = notSelected.findIndex((item) => item === displayItems[targetIdx as number]);
      insertIdx = notSelectedTargetIdx === -1 ? notSelected.length : notSelectedTargetIdx + 1;
    }

    const newItems = [
      ...notSelected.slice(0, insertIdx),
      ...selected,
      ...notSelected.slice(insertIdx),
    ];

    const newStatuses: Section["statuses"] = {};
    newItems.forEach((itemLabel, newIdx) => {
      const origIdx = section.items!.indexOf(itemLabel);
      if (origIdx !== -1 && section.statuses[section.startNum + origIdx]) {
        newStatuses[section.startNum + newIdx] = "read";
      }
    });
    onReorderItems(sectionId, newItems, newStatuses);
    setItemMoveTargetIdx(null);
    setSelectedItemIdxs(new Set());
    setItemSelectMode(null);
  }

  // ---- セクションドラッグ（ロック中でない通常モードのみ） ----
  function startSectionDrag(sectionId: string) {
    if (sectionSelectMode) return;
    setDraggingSectionId(sectionId);
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      const y = e.touches[0].clientY;
      const els = document.querySelectorAll("[data-section-id]");
      let found: number | null = null;
      for (let i = 0; i < els.length; i++) {
        const rect = els[i].getBoundingClientRect();
        if (y < rect.top + rect.height / 2) { found = i; break; }
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

  const filteredSections = useCallback(() => {
    const sections = applySectionSort(work.sections);
    if (!textSearch.trim()) return sections;
    return sections.map((s) => {
      if (s.mode !== "text" || !s.items) return s;
      return { ...s, _filteredItems: s.items.filter((item) => item.toLowerCase().includes(textSearch.toLowerCase())) };
    });
  }, [work.sections, textSearch, sectionSortOrder]);

  const showSectionMoveButton = sectionSelectMode && selectedSectionIds.size > 0;

  return (
    <div
      className="min-h-screen bg-[#1a1b26] flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => { setShowSectionSortMenu(false); setShowItemSortMenu(null); }}
    >
      <header className="sticky top-0 z-10 bg-[#1a1b26]/95 backdrop-blur-md border-b border-[#2a2d3e] px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="shrink-0 flex items-center gap-1 text-sm font-medium active:scale-95 transition-transform py-1 pr-2" style={{ color: folderHex }}>
              <ArrowLeft size={20} /><span>戻る</span>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-[#c0caf5] text-base leading-tight truncate">{work.title}</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* ロックボタン */}
              <button onClick={onToggleLock}
                className="w-8 h-8 flex items-center justify-center rounded-lg border active:scale-95 transition-all"
                style={locked
                  ? { backgroundColor: "#f7768e22", borderColor: "#f7768e", color: "#f7768e" }
                  : { backgroundColor: "#24283b", borderColor: "#3b4261", color: "#787c99" }
                }
                title={locked ? "ロック中（タップで解除）" : "ロック"}
              >{locked ? <LockKeyhole size={16} /> : <LockKeyholeOpen size={16} />}</button>

              {/* セクション選択モードボタン（複数セクションある場合のみ） */}
              {!locked && work.sections.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (sectionSelectMode) {
                      setSectionSelectMode(false);
                      setSelectedSectionIds(new Set());
                      setSectionMoveTargetId(null);
                    } else {
                      setSectionSelectMode(true);
                      setItemSelectMode(null);
                    }
                  }}
                  className="h-8 flex items-center justify-center rounded-lg border active:scale-95 transition-all px-2 gap-1"
                  style={sectionSelectMode
                    ? { backgroundColor: accentHex, borderColor: accentHex, color: "#1a1b26" }
                    : { backgroundColor: "#24283b", borderColor: "#3b4261", color: "#787c99" }
                  }
                  title={sectionSelectMode ? "完了" : "セクション並び替え"}
                >
                  {sectionSelectMode
                    ? <><Check size={14} /><span className="text-xs font-bold">完了</span></>
                    : <CheckSquare size={16} />
                  }
                </button>
              )}

              {/* セクション並び順ボタン（選択モード中は非表示） */}
              {work.sections.length > 1 && !sectionSelectMode && (
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); if (!locked) setShowSectionSortMenu((v) => !v); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border active:scale-95 transition-all"
                    style={showSectionSortMenu
                      ? { backgroundColor: accentHex, borderColor: accentHex, color: "#1a1b26" }
                      : sectionSortOrder !== "default"
                        ? { backgroundColor: `${accentHex}22`, borderColor: accentHex, color: accentHex }
                        : { backgroundColor: "#24283b", borderColor: "#3b4261", color: locked ? "#3b4261" : "#787c99" }
                    }
                    title="セクション並び順"
                  ><SlidersHorizontal size={16} /></button>
                  {showSectionSortMenu && (
                    <div className="absolute right-0 top-10 z-30 bg-[#1f2335] border border-[#3b4261] rounded-xl shadow-2xl overflow-hidden min-w-[140px]" onClick={(e) => e.stopPropagation()}>
                      {SECTION_SORT_OPTIONS.map((opt) => (
                        <button key={opt.value} onClick={() => handleSectionSortChange(opt.value)}
                          className="w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between gap-2"
                          style={{ color: sectionSortOrder === opt.value ? accentHex : "#a9b1d6", backgroundColor: sectionSortOrder === opt.value ? `${accentHex}11` : "transparent" }}
                        >{opt.label}{sectionSortOrder === opt.value && <Check size={14} />}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* テキスト検索ボタン */}
              {hasTextSections && !sectionSelectMode && (
                <button onClick={() => setShowTextSearch((v) => !v)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#24283b] border active:scale-95 transition-transform"
                  style={{ color: showTextSearch ? accentHex : "#787c99", borderColor: showTextSearch ? accentHex : "#3b4261" }}
                ><Search size={20} /></button>
              )}

              {/* 設定ボタン */}
              {!locked && !sectionSelectMode && (
                <button onClick={() => setShowWorkEdit(true)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#24283b] border border-[#3b4261] text-[#787c99] active:scale-95 transition-transform">
                  <Settings size={16} />
                </button>
              )}
            </div>
          </div>
          {sectionSelectMode && (
            <p className="text-xs text-[#787c99] text-center pt-2">
              {selectedSectionIds.size > 0
                ? `${selectedSectionIds.size}件選択中 — 移動先の「ここに移動」をタップ`
                : "タップして選択、もう一度タップで解除"}
            </p>
          )}
        </div>
      </header>

      <div className="px-4 py-3 max-w-lg mx-auto w-full">
        <div className="bg-[#24283b] border border-[#3b4261] rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-4 text-xs text-[#787c99]">
              <span><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ backgroundColor: accentHex }} />{work.labelRead} {read}</span>
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
          <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-5 rounded border border-[#3b4261] bg-[#24283b]" />{work.labelUnread}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-5 rounded border" style={{ backgroundColor: accentHex, borderColor: accentHex }} />{work.labelRead}</span>
          {locked && <span className="flex items-center gap-1 text-[#f7768e]"><LockKeyhole size={11} /> ロック中</span>}
        </div>
      </div>

      {hasTextSections && showTextSearch && (
        <div className="px-4 mb-2 max-w-lg mx-auto w-full">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#787c99]"><Search size={20} /></span>
            <input value={textSearch} onChange={(e) => setTextSearch(e.target.value)} placeholder="テキスト項目を検索..."
              className="w-full bg-[#24283b] text-[#c0caf5] border border-[#3b4261] rounded-xl pl-9 pr-8 py-2.5 text-sm outline-none focus:border-[#7aa2f7] transition-colors placeholder-[#4a5177]"
            />
            {textSearch && <button onClick={() => setTextSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#787c99]"><X size={20} /></button>}
          </div>
        </div>
      )}

      <main className="flex-1 px-3 max-w-lg mx-auto w-full pb-6">
        {work.sections.length === 0 ? (
          <div className="mt-12 text-center space-y-2 flex flex-col items-center">
            <div className="flex justify-center"><Grid2x2Check size={40} /></div>
            <p className="text-[#787c99] text-sm">{secLabel}がありません</p>
            {!locked && (
              <button onClick={() => setSectionModal({ mode: "add" })} className="mt-2 px-6 py-2.5 rounded-xl text-sm font-bold text-[#1a1b26] active:scale-95 transition-transform flex items-center justify-center gap-1" style={{ backgroundColor: accentHex }}>
                <Plus size={20} /> {secLabel}を追加
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* セクション先頭への「ここに移動」 */}
            {showSectionMoveButton && (
              <SectionMoveHereButton
                isTarget={sectionMoveTargetId === "top"}
                onToggle={() => setSectionMoveTargetId((v) => v === "top" ? null : "top")}
                onExecute={() => executeSectionMoveHere("top")}
                accentHex={accentHex}
              />
            )}
            {draggingSectionId && dragOverSectionIdx === 0 && !sectionSelectMode && <div className="h-0.5 rounded-full mx-1" style={{ backgroundColor: accentHex }} />}

            {filteredSections().map((section, sectionIndex) => {
              const sectionWithFilter = section as Section & { _filteredItems?: string[] };
              const rawItems = sectionWithFilter._filteredItems ?? section.items ?? [];
              const displayItems = textSearch ? rawItems : applyItemSort(rawItems, section);
              const { read: sRead, total: sTotal } = calcSectionProgress(section);
              const isDraggingThis = draggingSectionId === section.id;
              const itemSortOrder = section.sortOrder ?? "default";
              const isSectionChecked = selectedSectionIds.has(section.id);

              // このセクションがアイテム選択モードかどうか
              const isThisSectionItemSelect = itemSelectMode === section.id;
              const showItemMoveButton = isThisSectionItemSelect && selectedItemIdxs.size > 0;

              return (
                <div key={section.id}>
                  <div data-section-id={section.id} className={`transition-all duration-150 ${isDraggingThis ? "opacity-40 scale-[0.98]" : ""} ${isSectionChecked ? "ring-2 rounded-xl ring-[#7aa2f7]/40" : ""}`}>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* セクション選択チェック or ドラッグハンドル */}
                        {!locked && sectionSelectMode ? (
                          <button
                            className="shrink-0 w-7 h-7 flex items-center justify-center"
                            onClick={() => toggleSectionSelect(section.id)}
                            style={{ color: isSectionChecked ? "#7aa2f7" : "#4a5177" }}
                          >
                            {isSectionChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        ) : !locked && work.sections.length > 1 ? (
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
                                  if (me.clientY < rect.top + rect.height / 2) { found = i; break; }
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
                          ><GripVertical size={20} /></button>
                        ) : null}

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

                      {/* セクション選択モード中はアイコン非表示 */}
                      {!sectionSelectMode && (
                        <div className="flex gap-1 items-center">
                          {/* テキストモード: 項目並び順 or 選択モード */}
                          {section.mode === "text" && !locked && (
                            <>
                              {/* 項目選択モードボタン */}
                              {section.items && section.items.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isThisSectionItemSelect) {
                                      setItemSelectMode(null);
                                    } else {
                                      setItemSelectMode(section.id);
                                      setSelectedItemIdxs(new Set());
                                      setItemMoveTargetIdx(null);
                                    }
                                  }}
                                  className="h-7 flex items-center justify-center rounded-lg border active:scale-95 transition-all px-1.5 gap-0.5"
                                  style={isThisSectionItemSelect
                                    ? { backgroundColor: accentHex, borderColor: accentHex, color: "#1a1b26" }
                                    : { backgroundColor: "transparent", borderColor: "transparent", color: "#787c99" }
                                  }
                                  title={isThisSectionItemSelect ? "完了" : "項目並び替え"}
                                >
                                  {isThisSectionItemSelect
                                    ? <><Check size={12} /><span className="text-xs font-bold">完了</span></>
                                    : <CheckSquare size={14} />
                                  }
                                </button>
                              )}
                              {/* 項目並び順ボタン（選択モード中は非表示） */}
                              {!isThisSectionItemSelect && (
                                <div className="relative">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setShowItemSortMenu((v) => v === section.id ? null : section.id); }}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg border active:scale-95 transition-all"
                                    style={showItemSortMenu === section.id
                                      ? { backgroundColor: accentHex, borderColor: accentHex, color: "#1a1b26" }
                                      : itemSortOrder !== "default"
                                        ? { backgroundColor: `${accentHex}22`, borderColor: accentHex, color: accentHex }
                                        : { backgroundColor: "transparent", borderColor: "transparent", color: "#787c99" }
                                    }
                                    title="項目の並び順"
                                  ><SlidersHorizontal size={14} /></button>
                                  {showItemSortMenu === section.id && (
                                    <div className="absolute right-0 top-8 z-30 bg-[#1f2335] border border-[#3b4261] rounded-xl shadow-2xl overflow-hidden min-w-[140px]" onClick={(e) => e.stopPropagation()}>
                                      {ITEM_SORT_OPTIONS.map((opt) => (
                                        <button key={opt.value} onClick={() => handleItemSortChange(section.id, opt.value)}
                                          className="w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between gap-2"
                                          style={{ color: itemSortOrder === opt.value ? accentHex : "#a9b1d6", backgroundColor: itemSortOrder === opt.value ? `${accentHex}11` : "transparent" }}
                                        >{opt.label}{itemSortOrder === opt.value && <Check size={14} />}</button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                          {!locked && (
                            <>
                              <button onClick={() => setSectionModal({ mode: "edit", section })} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#787c99] active:scale-95 transition-transform"><Settings size={16} /></button>
                              <button onClick={() => handleDeleteSection(section)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#f7768e] active:scale-95 transition-transform"><Trash2 size={16} /></button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* セクション選択モード中はコンテンツをタップで選択 */}
                    {sectionSelectMode ? (
                      <button
                        className="w-full text-left px-3 py-2 rounded-xl border transition-all active:scale-[0.98]"
                        style={{ borderColor: isSectionChecked ? "#7aa2f7" : "#3b4261", backgroundColor: isSectionChecked ? "#7aa2f711" : "#24283b" }}
                        onClick={() => toggleSectionSelect(section.id)}
                      >
                        <span className="text-xs text-[#787c99]">{section.mode === "text" ? `${sTotal}項目` : `${section.startNum}〜${section.endNum}${work.unit}`}</span>
                      </button>
                    ) : section.mode === "text" && section.items ? (
                      <div className="space-y-1.5">
                        {/* 項目先頭への「ここに移動」 */}
                        {showItemMoveButton && (
                          <ItemMoveHereButton
                            isTarget={itemMoveTargetIdx === "top"}
                            onToggle={() => setItemMoveTargetIdx((v) => v === "top" ? null : "top")}
                            onExecute={() => executeItemMoveHere(section.id, displayItems, "top")}
                            accentHex={accentHex}
                          />
                        )}
                        {displayItems.map((itemLabel, idx) => {
                          const realIdx = section.items!.indexOf(itemLabel);
                          const num = section.startNum + realIdx;
                          const isRead = !!section.statuses[num];
                          const isItemChecked = selectedItemIdxs.has(idx);
                          return (
                            <div key={`${section.id}-${idx}`}>
                              <button
                                id={`item-${section.id}-${num}`}
                                data-item-section={section.id}
                                onClick={() => {
                                  if (isThisSectionItemSelect) {
                                    toggleItemSelect(idx);
                                    return;
                                  }
                                  handleToggle(section.id, num);
                                }}
                                onTouchStart={(e) => { e.stopPropagation(); }}
                                className={`w-full border rounded-xl px-4 py-3 text-left text-sm font-medium select-none touch-manipulation transition-all duration-100 ${locked ? "" : "active:scale-[0.98]"}`}
                                style={
                                  isThisSectionItemSelect
                                    ? isItemChecked
                                      ? { backgroundColor: "#7aa2f722", color: "#c0caf5", borderColor: "#7aa2f7" }
                                      : { backgroundColor: "#24283b", color: "#c0caf5", borderColor: "#3b4261" }
                                    : isRead
                                      ? { backgroundColor: accentHex, color: "#1a1b26", borderColor: accentHex }
                                      : { backgroundColor: "#24283b", color: "#c0caf5", borderColor: "#3b4261" }
                                }
                              >
                                <div className="flex items-center gap-2">
                                  {isThisSectionItemSelect && (
                                    <span className="shrink-0" style={{ color: isItemChecked ? "#7aa2f7" : "#4a5177" }}>
                                      {isItemChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                                    </span>
                                  )}
                                  <span className="whitespace-pre-wrap break-words flex-1">{itemLabel}</span>
                                </div>
                              </button>
                              {/* 各項目の後の「ここに移動」 */}
                              {showItemMoveButton && !isItemChecked && (
                                <ItemMoveHereButton
                                  isTarget={itemMoveTargetIdx === idx}
                                  onToggle={() => setItemMoveTargetIdx((v) => v === idx ? null : idx)}
                                  onExecute={() => executeItemMoveHere(section.id, displayItems, idx)}
                                  accentHex={accentHex}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                        {Array.from({ length: section.endNum - section.startNum + 1 }, (_, i) => section.startNum + i).map((num) => {
                          const isRead = !!section.statuses[num];
                          return (
                            <button key={num} id={`item-${section.id}-${num}`}
                              onClick={() => handleToggle(section.id, num)}
                              className={`border rounded-xl aspect-square flex items-center justify-center font-bold text-sm select-none touch-manipulation transition-all duration-100 ${locked ? "" : "active:scale-90"}`}
                              style={isRead ? { backgroundColor: accentHex, color: "#1a1b26", borderColor: accentHex } : { backgroundColor: "#24283b", color: locked ? "#3b4261" : "#4a5177", borderColor: "#3b4261" }}
                            >{num}</button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* セクション間の「ここに移動」 */}
                  {showSectionMoveButton && !isSectionChecked && (
                    <SectionMoveHereButton
                      isTarget={sectionMoveTargetId === section.id}
                      onToggle={() => setSectionMoveTargetId((v) => v === section.id ? null : section.id)}
                      onExecute={() => executeSectionMoveHere(section.id)}
                      accentHex={accentHex}
                    />
                  )}

                  {!sectionSelectMode && draggingSectionId && dragOverSectionIdx === sectionIndex + 1 && <div className="h-0.5 rounded-full mx-1 mt-5" style={{ backgroundColor: accentHex }} />}
                </div>
              );
            })}
            {!locked && !sectionSelectMode && (
              <button onClick={() => setSectionModal({ mode: "add" })} className="w-full py-3 rounded-xl border border-dashed border-[#3b4261] text-[#787c99] text-sm active:scale-95 transition-transform flex items-center justify-center gap-1.5">
                <Plus size={20} /><span>{secLabel}を追加</span>
              </button>
            )}
          </div>
        )}
      </main>

      {showWorkEdit && <WorkModal mode="edit" initial={work} onClose={() => setShowWorkEdit(false)} onSave={(data) => { onEditWork(data); setShowWorkEdit(false); }} />}
      {sectionModal?.mode === "add" && (
        <SectionModal mode="add" labelName={secLabel} workId={work.id} defaults={getAddSectionDefaults()}
          onClose={() => setSectionModal(null)}
          onSave={(label, startNum, endNum, sectionMode, items) => { onAddSection({ label, startNum, endNum, mode: sectionMode, items }); setSectionModal(null); }}
        />
      )}
      {sectionModal?.mode === "edit" && (
        <SectionModal mode="edit" labelName={secLabel} workId={work.id} initial={sectionModal.section}
          onClose={() => setSectionModal(null)}
          onSave={(label, startNum, endNum, sectionMode, items) => { onEditSection(sectionModal.section.id, { label, startNum, endNum, mode: sectionMode, items }); setSectionModal(null); }}
        />
      )}
    </div>
  );
}

function SectionMoveHereButton({ isTarget, onToggle, onExecute, accentHex }: { isTarget: boolean; onToggle: () => void; onExecute: () => void; accentHex: string }) {
  return (
    <div className="flex items-center gap-2 py-1 px-1">
      <div className="flex-1 h-px" style={{ backgroundColor: isTarget ? accentHex : "#2a2d3e" }} />
      {isTarget ? (
        <button onClick={(e) => { e.stopPropagation(); onExecute(); }} className="w-7 h-7 flex items-center justify-center rounded-full active:scale-95 transition-all" style={{ backgroundColor: accentHex, color: "#1a1b26" }}>
          <ArrowDownToLine size={14} />
        </button>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="w-7 h-7 flex items-center justify-center rounded-full border active:scale-95 transition-all" style={{ borderColor: "#3b4261", color: "#4a5177", backgroundColor: "#1a1b26" }}>
          <ArrowDownToLine size={14} />
        </button>
      )}
      <div className="flex-1 h-px" style={{ backgroundColor: isTarget ? accentHex : "#2a2d3e" }} />
    </div>
  );
}

function ItemMoveHereButton({ isTarget, onToggle, onExecute, accentHex }: { isTarget: boolean; onToggle: () => void; onExecute: () => void; accentHex: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 px-1 mt-1">
      <div className="flex-1 h-px" style={{ backgroundColor: isTarget ? accentHex : "#2a2d3e" }} />
      {isTarget ? (
        <button onClick={(e) => { e.stopPropagation(); onExecute(); }} className="w-6 h-6 flex items-center justify-center rounded-full active:scale-95 transition-all" style={{ backgroundColor: accentHex, color: "#1a1b26" }}>
          <ArrowDownToLine size={12} />
        </button>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="w-6 h-6 flex items-center justify-center rounded-full border active:scale-95 transition-all" style={{ borderColor: "#3b4261", color: "#4a5177", backgroundColor: "#1a1b26" }}>
          <ArrowDownToLine size={12} />
        </button>
      )}
      <div className="flex-1 h-px" style={{ backgroundColor: isTarget ? accentHex : "#2a2d3e" }} />
    </div>
  );
}
