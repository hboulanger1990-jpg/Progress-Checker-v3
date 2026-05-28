import { Settings, Trash2, Search, ArrowLeft, X, Plus, GripVertical, Grid2x2Check, LockKeyhole, LockKeyholeOpen, SlidersHorizontal, Check, CheckSquare, Square, ArrowDownToLine } from "lucide-react";
import { useState, useRef, useEffect, useCallback, type RefObject } from "react";
import type { Folder, Work, Section, SortOrder } from "../types";
import { ACCENT_COLORS } from "../types";
import { calcWorkProgress, calcSectionProgress } from "../storage";
import WorkModal from "../modals/WorkModal";
import SectionModal from "../modals/SectionModal";

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
  work: Work;
  locked: boolean;
  theme: "dark" | "light" | "sepia";
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
  folder, work, locked, theme, onToggleLock, onBack, onEditWork, onDeleteWork,
  onAddSection, onEditSection, onDeleteSection, onToggleItem,
  onReorderSections, onReorderItems, onSetSectionSortOrder, onSetAllSectionsSortOrder,
}: Props) {
  const [showWorkEdit, setShowWorkEdit] = useState(false);
  const [sectionModal, setSectionModal] = useState<SectionModalState>(null);
  const [textSearch, setTextSearch] = useState("");
  const [showTextSearch, setShowTextSearch] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"read" | "unread" | null>(null);

  const [sectionSortOrder, setSectionSortOrder] = useState<SortOrder>(() => work.sections[0]?.sortOrder ?? "default");
  const [showSectionSortMenu, setShowSectionSortMenu] = useState(false);
  const [showItemSortMenu, setShowItemSortMenu] = useState<string | null>(null);

  // セクション選択モード
  const [sectionSelectMode, setSectionSelectMode] = useState(false);
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set());
  const [sectionMoveTargetId, setSectionMoveTargetId] = useState<string | "top" | null>(null);
  const [showSectionMoveMode, setShowSectionMoveMode] = useState(false);

  // テキスト項目選択モード（sectionId -> Set<idx>）
  const [itemSelectMode, setItemSelectMode] = useState<string | null>(null); // sectionId or null
  const [selectedItemIdxs, setSelectedItemIdxs] = useState<Set<number>>(new Set());
  const [itemMoveTargetIdx, setItemMoveTargetIdx] = useState<number | "top" | null>(null);
  const [showItemMoveMode, setShowItemMoveMode] = useState(false);

  // インライン項目追加
  const [inlineAdd, setInlineAdd] = useState<{ sectionId: string; position: "top" | "bottom" } | null>(null);
  const [inlineAddText, setInlineAddText] = useState("");
  const inlineAddRef = useRef<HTMLTextAreaElement>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dragOverSectionIdx, setDragOverSectionIdx] = useState<number | null>(null);

  const touchStart = useRef({ x: 0, y: 0 });
  const justBecameVisible = useRef(false);
  const touchMoveHandler = useRef<((e: TouchEvent) => void) | null>(null);
  const touchEndHandler = useRef<((e: TouchEvent) => void) | null>(null);

  const accentHex = ACCENT_COLORS[work.accentColor].hex;
  const accentBgSepia = ACCENT_COLORS[work.accentColor].bgSepia;
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
      setShowSectionMoveMode(false);
      setItemSelectMode(null);
      setSelectedItemIdxs(new Set());
      setItemMoveTargetIdx(null);
      setShowItemMoveMode(false);
    }
  }, [locked]);

  useEffect(() => {
    if (!sectionSelectMode) {
      setSectionMoveTargetId(null);
      setShowSectionMoveMode(false);
    }
  }, [sectionSelectMode]);

  useEffect(() => {
    if (!itemSelectMode) {
      setItemMoveTargetIdx(null);
      setSelectedItemIdxs(new Set());
      setShowItemMoveMode(false);
    }
  }, [itemSelectMode]);

  function commitInlineAdd(sectionId: string, position: "top" | "bottom", text: string) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
    if (lines.length === 0) { setInlineAdd(null); setInlineAddText(""); return; }
    const section = work.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const existing = section.items ?? [];
    const newItems = position === "top" ? [...lines, ...existing] : [...existing, ...lines];
    const newStatuses: Section["statuses"] = {};
    newItems.forEach((item, newIdx) => {
      const origIdx = existing.indexOf(item);
      if (origIdx !== -1 && section.statuses[section.startNum + origIdx]) {
        newStatuses[section.startNum + newIdx] = "read";
      }
    });
    onEditSection(sectionId, { items: newItems, startNum: 1, endNum: newItems.length });
    setInlineAdd(null);
    setInlineAddText("");
  }

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
    setShowSectionMoveMode(false);
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
    setShowItemMoveMode(false);
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
    // 移動後、選択済みアイテムの新しいインデックスに更新
    const newSelectedIdxs = new Set<number>();
    selected.forEach((item) => {
      const newIdx = newItems.indexOf(item);
      if (newIdx !== -1) newSelectedIdxs.add(newIdx);
    });
    setSelectedItemIdxs(newSelectedIdxs);
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
    return sections.map((s) => {
      if (s.mode === "text" && s.items) {
        let items = textSearch.trim()
          ? s.items.filter((item) => item.toLowerCase().includes(textSearch.toLowerCase()))
          : s.items;
        if (statusFilter) {
          items = items.filter((item, i) => {
            const num = s.startNum + s.items!.indexOf(item);
            const isRead = !!s.statuses[num];
            return statusFilter === "read" ? isRead : !isRead;
          });
        }
        return { ...s, _filteredItems: items };
      }
      if (s.mode !== "text" && statusFilter) {
        const allNums = Array.from({ length: s.endNum - s.startNum + 1 }, (_, i) => s.startNum + i);
        const filtered = allNums.filter((num) => {
          const isRead = !!s.statuses[num];
          return statusFilter === "read" ? isRead : !isRead;
        });
        return { ...s, _filteredNums: filtered };
      }
      if (textSearch.trim() && s.mode === "text" && s.items) {
        return { ...s, _filteredItems: s.items.filter((item) => item.toLowerCase().includes(textSearch.toLowerCase())) };
      }
      return s;
    });
  }, [work.sections, textSearch, sectionSortOrder, statusFilter]);

  const showSectionMoveButton = showSectionMoveMode && selectedSectionIds.size > 0;

  return (
    <div
      className="min-h-screen flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => { setShowSectionSortMenu(false); setShowItemSortMenu(null); }}
    >
      <header className="sticky top-0 z-10 bg-[var(--bg-base)]/95 backdrop-blur-md border-b border-[var(--border-dim)] px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="shrink-0 flex items-center gap-1 text-sm font-medium active:scale-95 transition-transform py-1 pr-2" style={{ color: folderHex }}>
              <ArrowLeft size={20} /><span>戻る</span>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-base leading-tight truncate" style={{ color: theme === "sepia" ? "#c0392b" : "var(--text-primary)" }}>{work.title}</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* ロックボタン */}
              <button onClick={onToggleLock}
                className="w-8 h-8 flex items-center justify-center rounded-lg border active:scale-95 transition-all"
                style={locked
                  ? { backgroundColor: "#f7768e22", borderColor: "#f7768e", color: "#f7768e" }
                  : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-muted)" }
                }
                title={locked ? "ロック中（タップで解除）" : "ロック"}
              >{locked ? <LockKeyhole size={16} /> : <LockKeyholeOpen size={16} />}</button>

              {/* セクション選択モードボタン（複数セクションある場合のみ、常時表示） */}
              {work.sections.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (locked) return;
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
                    ? { backgroundColor: accentHex, borderColor: accentHex, color: "var(--bg-base)" }
                    : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: locked ? "var(--border)" : "var(--text-muted)" }
                  }
                  title={sectionSelectMode ? "選択モード終了" : locked ? "ロック中" : "セクション並び替え"}
                >
                  {sectionSelectMode
                    ? <Check size={16} />
                    : <CheckSquare size={16} />
                  }
                </button>
              )}

              {/* セクション並び順ボタン（常時表示、sectionSelectMode中は薄く無効） */}
              {work.sections.length > 1 && (
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); if (!locked && !sectionSelectMode) setShowSectionSortMenu((v) => !v); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border active:scale-95 transition-all"
                    style={sectionSelectMode
                      ? { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--locked-color)" }
                      : showSectionSortMenu
                        ? { backgroundColor: accentHex, borderColor: accentHex, color: "var(--bg-base)" }
                        : sectionSortOrder !== "default"
                          ? { backgroundColor: `${accentHex}22`, borderColor: accentHex, color: accentHex }
                          : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: locked ? "var(--border)" : "var(--text-muted)" }
                    }
                    title="セクション並び順"
                  ><SlidersHorizontal size={16} /></button>
                  {showSectionSortMenu && (
                    <div className="absolute right-0 top-10 z-30 bg-[var(--bg-overlay)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden min-w-[140px]" onClick={(e) => e.stopPropagation()}>
                      {SECTION_SORT_OPTIONS.map((opt) => (
                        <button key={opt.value} onClick={() => handleSectionSortChange(opt.value)}
                          className="w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between gap-2"
                          style={{ color: sectionSortOrder === opt.value ? accentHex : "var(--text-sub)", backgroundColor: sectionSortOrder === opt.value ? `${accentHex}11` : "transparent" }}
                        >{opt.label}{sectionSortOrder === opt.value && <Check size={14} />}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* テキスト検索ボタン（常時表示、hasTextSectionsのみ） */}
              {hasTextSections && (
                <button
                  onClick={() => { if (!sectionSelectMode) setShowTextSearch((v) => !v); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border active:scale-95 transition-transform"
                  style={sectionSelectMode
                    ? { color: "var(--border)", borderColor: "var(--border)" }
                    : showTextSearch
                      ? { backgroundColor: accentHex, borderColor: accentHex, color: "var(--bg-base)" }
                      : { backgroundColor: "var(--bg-surface)", color: "var(--text-muted)", borderColor: "var(--border)" }
                  }
                ><Search size={20} /></button>
              )}

              {/* 設定ボタン（常時表示、ロック中・選択モード中は薄く） */}
              <button
                onClick={() => { if (!locked && !sectionSelectMode) setShowWorkEdit(true); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] active:scale-95 transition-transform"
                style={{ color: locked || sectionSelectMode ? "var(--border)" : "var(--text-muted)" }}
                title={locked ? "ロック中" : sectionSelectMode ? "選択モード中" : "設定"}
              >
                <Settings size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 pt-3 pb-2 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[var(--text-muted)]">
            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: accentHex }} />
            {work.labelRead} {read} / {total}{work.unit}
          </span>
          <span className="text-xs font-bold" style={{ color: theme === "sepia" ? accentHex : mixWithGray(accentHex, theme, 0.3) }}>{percent}%</span>
        </div>
        <div className="h-1 bg-[var(--bg-surface)] rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: theme === "sepia" ? accentHex : mixWithGray(accentHex, theme, 0.3) }} />
        </div>
        <div className="flex gap-3 text-xs text-[var(--text-muted)]">
          <button
            onClick={() => { if (!locked) setStatusFilter((v) => v === "unread" ? null : "unread"); }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all active:scale-95"
            style={statusFilter === "unread"
              ? { backgroundColor: "var(--bg-surface)", borderColor: "var(--text-muted)", color: "var(--text-primary)" }
              : { backgroundColor: "transparent", borderColor: "transparent", color: locked ? "var(--border)" : "var(--text-muted)" }
            }
          >
            <span className="inline-block w-3.5 h-3.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] shrink-0" />
            {work.labelUnread}
          </button>
          <button
            onClick={() => { if (!locked) setStatusFilter((v) => v === "read" ? null : "read"); }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all active:scale-95"
            style={statusFilter === "read"
              ? { backgroundColor: `${accentHex}22`, borderColor: accentHex, color: accentHex }
              : { backgroundColor: "transparent", borderColor: "transparent", color: locked ? "var(--border)" : "var(--text-muted)" }
            }
          >
            <span className="inline-block w-3.5 h-3.5 rounded shrink-0" style={{ backgroundColor: accentHex }} />
            {work.labelRead}
          </button>
          {locked && <span className="flex items-center gap-1 text-[#f7768e] ml-auto"><LockKeyhole size={11} /> ロック中</span>}
        </div>
      </div>

      {hasTextSections && showTextSearch && (
        <div className="px-4 mb-2 max-w-lg mx-auto w-full">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><Search size={20} /></span>
            <input value={textSearch} onChange={(e) => setTextSearch(e.target.value)} placeholder="テキスト項目を検索..."
              className="w-full bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl pl-9 pr-8 py-2.5 text-sm outline-none focus:border-[#7aa2f7] transition-colors placeholder-[var(--text-dim)]"
            />
            {textSearch && <button onClick={() => setTextSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><X size={20} /></button>}
          </div>
        </div>
      )}

      <main className="flex-1 px-3 max-w-lg mx-auto w-full pb-6">
        {work.sections.length === 0 ? (
          <div className="mt-12 text-center space-y-2 flex flex-col items-center">
            <div className="flex justify-center"><Grid2x2Check size={40} /></div>
            <p className="text-[var(--text-muted)] text-sm">{secLabel}がありません</p>
            {!locked && (
              <button onClick={() => setSectionModal({ mode: "add" })} className="mt-2 px-6 py-2.5 rounded-xl text-sm font-bold text-[var(--bg-base)] active:scale-95 transition-transform flex items-center justify-center gap-1" style={{ backgroundColor: accentHex }}>
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
              const showItemMoveButton = showItemMoveMode && isThisSectionItemSelect && selectedItemIdxs.size > 0;

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
                            style={{ color: isSectionChecked ? "#7aa2f7" : "var(--text-dim)" }}
                          >
                            {isSectionChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        ) : !locked && work.sections.length > 1 ? (
                          <button
                            className="shrink-0 w-7 h-7 flex items-center justify-center text-[var(--text-dim)] cursor-grab active:cursor-grabbing touch-none select-none"
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
                          <span className="font-bold text-[var(--text-primary)] text-sm">{section.label}</span>
                          <span className="text-xs text-[var(--text-muted)] ml-2">
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
                              {section.items && section.items.length > 1 && (() => {
                                const itemIsReverse = (section.sortOrder ?? "default") === "reverse";
                                const itemSelectDisabled = !isThisSectionItemSelect && itemIsReverse;
                                return (
                                  <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (itemSelectDisabled) return;
                                      if (isThisSectionItemSelect) {
                                        setItemSelectMode(null);
                                        setShowItemMoveMode(false);
                                      } else {
                                        setItemSelectMode(section.id);
                                        setSelectedItemIdxs(new Set());
                                        setItemMoveTargetIdx(null);
                                        setShowItemMoveMode(false);
                                      }
                                    }}
                                    className="h-7 flex items-center justify-center rounded-lg border active:scale-95 transition-all px-1.5 gap-0.5"
                                    style={isThisSectionItemSelect
                                      ? { backgroundColor: accentHex, borderColor: accentHex, color: "var(--bg-base)" }
                                      : { backgroundColor: "transparent", borderColor: "transparent", color: itemSelectDisabled ? "var(--border)" : "var(--text-muted)" }
                                    }
                                    title={isThisSectionItemSelect ? "選択モード終了" : itemIsReverse ? "逆順中は並び替え不可" : "項目並び替え"}
                                  >
                                    {isThisSectionItemSelect
                                      ? <Check size={14} />
                                      : <CheckSquare size={14} />
                                    }
                                  </button>
                                  {/* 項目選択中の「移動」ボタン（常時表示、選択時のみ有効） */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); if (isThisSectionItemSelect) { setShowItemMoveMode((v) => !v); setItemMoveTargetIdx(null); } }}
                                    disabled={!isThisSectionItemSelect || selectedItemIdxs.size === 0}
                                    className="h-7 flex items-center justify-center rounded-lg border active:scale-95 transition-all px-1.5 gap-0.5"
                                    style={!isThisSectionItemSelect
                                      ? { backgroundColor: "transparent", borderColor: "transparent", color: "var(--locked-color)" }
                                      : showItemMoveMode
                                        ? { backgroundColor: accentHex, borderColor: accentHex, color: "var(--bg-base)" }
                                        : selectedItemIdxs.size === 0
                                          ? { backgroundColor: "transparent", borderColor: "transparent", color: "var(--border)" }
                                          : { backgroundColor: "transparent", borderColor: "transparent", color: "var(--text-muted)" }
                                    }
                                    title="移動"
                                  ><ArrowDownToLine size={14} /></button>
                                  </>
                                );
                              })()}
                              {/* 項目並び順ボタン（常時表示、アイテム選択モード中は薄く無効） */}
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); if (!isThisSectionItemSelect) setShowItemSortMenu((v) => v === section.id ? null : section.id); }}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg border active:scale-95 transition-all"
                                  style={isThisSectionItemSelect
                                    ? { backgroundColor: "transparent", borderColor: "transparent", color: "var(--locked-color)" }
                                    : showItemSortMenu === section.id
                                      ? { backgroundColor: accentHex, borderColor: accentHex, color: "var(--bg-base)" }
                                      : itemSortOrder !== "default"
                                        ? { backgroundColor: `${accentHex}22`, borderColor: accentHex, color: accentHex }
                                        : { backgroundColor: "transparent", borderColor: "transparent", color: "var(--text-muted)" }
                                  }
                                  title="項目の並び順"
                                ><SlidersHorizontal size={14} /></button>
                                {showItemSortMenu === section.id && (
                                    <div className="absolute right-0 top-8 z-30 bg-[var(--bg-overlay)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden min-w-[140px]" onClick={(e) => e.stopPropagation()}>
                                      {ITEM_SORT_OPTIONS.map((opt) => (
                                        <button key={opt.value} onClick={() => handleItemSortChange(section.id, opt.value)}
                                          className="w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between gap-2"
                                          style={{ color: itemSortOrder === opt.value ? accentHex : "var(--text-sub)", backgroundColor: itemSortOrder === opt.value ? `${accentHex}11` : "transparent" }}
                                        >{opt.label}{itemSortOrder === opt.value && <Check size={14} />}</button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                            </>
                          )}
                          {!locked && (
                            <>
                              <button onClick={() => setSectionModal({ mode: "edit", section })} className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] active:scale-95 transition-transform"><Settings size={16} /></button>
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
                        style={{ borderColor: isSectionChecked ? "#7aa2f7" : "var(--border)", backgroundColor: isSectionChecked ? "#7aa2f711" : "var(--bg-surface)" }}
                        onClick={() => toggleSectionSelect(section.id)}
                      >
                        <span className="text-xs text-[var(--text-muted)]">{section.mode === "text" ? `${sTotal}項目` : `${section.startNum}〜${section.endNum}${work.unit}`}</span>
                      </button>
                    ) : section.mode === "text" && section.items ? (
                      <div className="space-y-1.5">
                        {/* 先頭インライン追加 */}
                        {!locked && !sectionSelectMode && (
                          inlineAdd?.sectionId === section.id && inlineAdd.position === "top" && !isThisSectionItemSelect ? (
                            <InlineAddInput
                              accentHex={accentHex}
                              inputRef={inlineAdd.sectionId === section.id ? inlineAddRef : undefined}
                              value={inlineAddText}
                              onChange={setInlineAddText}
                              onCommit={() => commitInlineAdd(section.id, "top", inlineAddText)}
                              onCancel={() => { setInlineAdd(null); setInlineAddText(""); }}
                            />
                          ) : (
                            <button
                              onClick={() => { if (isThisSectionItemSelect) return; setInlineAdd({ sectionId: section.id, position: "top" }); setInlineAddText(""); setTimeout(() => inlineAddRef.current?.focus(), 30); }}
                              className="w-full py-0.5 rounded border border-dashed flex items-center justify-center"
                              style={{ borderColor: "var(--border-dim)", color: "var(--text-dim)", visibility: isThisSectionItemSelect ? "hidden" : "visible" }}
                            ><Plus size={14} /></button>
                          )
                        )}
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
                                      ? isRead
                                        ? { backgroundColor: theme === "sepia" ? accentBgSepia : mixWithGray(accentHex, theme, 0.3), color: theme === "dark" ? "var(--bg-base)" : "var(--text-primary)", borderColor: "var(--bg-base)", outline: "2px solid var(--bg-base)66" }
                                        : { backgroundColor: "#7aa2f722", color: "var(--text-primary)", borderColor: "#7aa2f7" }
                                      : isRead
                                        ? { backgroundColor: theme === "sepia" ? accentBgSepia : mixWithGray(accentHex, theme, 0.3), color: theme === "dark" ? "var(--bg-base)" : "var(--text-primary)", borderColor: theme === "sepia" ? accentBgSepia : mixWithGray(accentHex, theme, 0.3) }
                                        : { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", borderColor: "var(--border)" }
                                    : isRead
                                      ? { backgroundColor: theme === "sepia" ? accentBgSepia : mixWithGray(accentHex, theme, 0.3), color: theme === "dark" ? "var(--bg-base)" : "var(--text-primary)", borderColor: theme === "sepia" ? accentBgSepia : mixWithGray(accentHex, theme, 0.3) }
                                      : { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", borderColor: "var(--border)" }
                                }
                              >
                                <div className="flex items-center gap-2">
                                  {isThisSectionItemSelect && (
                                    <span className="shrink-0" style={{ color: isItemChecked ? (isRead ? (theme === "dark" ? "var(--bg-base)" : "var(--text-primary)") : "#7aa2f7") : isRead ? (theme === "dark" ? "var(--bg-base)99" : "var(--text-primary)99") : "var(--text-dim)" }}>
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
                        {/* 末尾インライン追加 */}
                        {!locked && !sectionSelectMode && (
                          inlineAdd?.sectionId === section.id && inlineAdd.position === "bottom" && !isThisSectionItemSelect ? (
                            <InlineAddInput
                              accentHex={accentHex}
                              inputRef={inlineAdd.sectionId === section.id ? inlineAddRef : undefined}
                              value={inlineAddText}
                              onChange={setInlineAddText}
                              onCommit={() => commitInlineAdd(section.id, "bottom", inlineAddText)}
                              onCancel={() => { setInlineAdd(null); setInlineAddText(""); }}
                            />
                          ) : (
                            <button
                              onClick={() => { if (isThisSectionItemSelect) return; setInlineAdd({ sectionId: section.id, position: "bottom" }); setInlineAddText(""); setTimeout(() => inlineAddRef.current?.focus(), 30); }}
                              className="w-full py-0.5 rounded border border-dashed flex items-center justify-center"
                              style={{ borderColor: "var(--border-dim)", color: "var(--text-dim)", visibility: isThisSectionItemSelect ? "hidden" : "visible" }}
                            ><Plus size={14} /></button>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                        {((section as Section & { _filteredNums?: number[] })._filteredNums
                          ?? Array.from({ length: section.endNum - section.startNum + 1 }, (_, i) => section.startNum + i)
                        ).map((num) => {
                          const isRead = !!section.statuses[num];
                          return (
                            <button key={num} id={`item-${section.id}-${num}`}
                              onClick={() => handleToggle(section.id, num)}
                              className={`border rounded-xl aspect-square flex items-center justify-center font-bold text-sm select-none touch-manipulation transition-all duration-100 ${locked ? "" : "active:scale-90"}`}
                              style={isRead ? { backgroundColor: theme === "sepia" ? accentBgSepia : mixWithGray(accentHex, theme, 0.3), color: theme === "dark" ? "var(--bg-base)" : "var(--text-primary)", borderColor: theme === "sepia" ? accentBgSepia : mixWithGray(accentHex, theme, 0.3) } : { backgroundColor: "var(--bg-surface)", color: locked ? "var(--border)" : "var(--text-dim)", borderColor: "var(--border)" }}
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
              <button onClick={() => setSectionModal({ mode: "add" })} className="w-full py-3 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-muted)] text-sm active:scale-95 transition-transform flex items-center justify-center gap-1.5">
                <Plus size={20} /><span>{secLabel}を追加</span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* セクション選択モード フッター */}
      {!locked && sectionSelectMode && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)]/90 to-transparent">
          <div className="max-w-lg mx-auto flex gap-2">
            <button
              onClick={() => { setShowSectionMoveMode((v) => !v); setSectionMoveTargetId(null); }}
              disabled={selectedSectionIds.size === 0}
              className="flex-1 py-3 rounded-2xl border text-sm font-medium active:scale-95 transition-transform flex items-center justify-center gap-2"
              style={showSectionMoveMode
                ? { backgroundColor: accentHex, borderColor: accentHex, color: "var(--bg-base)" }
                : selectedSectionIds.size === 0
                  ? { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--border)" }
                  : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-sub)" }
              }
            ><ArrowDownToLine size={16} /> 移動</button>
          </div>
        </div>
      )}

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

function InlineAddInput({ accentHex, inputRef, value, onChange, onCommit, onCancel }: {
  accentHex: string;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-2 items-start">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onCommit(); }
          if (e.key === "Escape") onCancel();
        }}
        placeholder={"項目を入力（複数行可、Shift+Enterで改行）"}
        rows={2}
        className="flex-1 bg-[var(--bg-surface)] text-[var(--text-primary)] border rounded-xl px-3 py-2 text-sm outline-none transition-colors placeholder-[var(--text-dim)] resize-none"
        style={{ borderColor: accentHex }}
      />
      <div className="flex flex-col gap-1 shrink-0">
        <button onClick={onCommit} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--bg-base)] active:scale-95 transition-transform text-xs font-bold" style={{ backgroundColor: accentHex }}>✓</button>
        <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] active:scale-95 transition-transform text-xs">✕</button>
      </div>
    </div>
  );
}

function SectionMoveHereButton({ isTarget, onToggle, onExecute, accentHex }: { isTarget: boolean; onToggle: () => void; onExecute: () => void; accentHex: string }) {
  return (
    <div className="flex items-center gap-2 py-1 px-1">
      <div className="flex-1 h-px" style={{ backgroundColor: isTarget ? accentHex : "var(--border-dim)" }} />
      {isTarget ? (
        <button onClick={(e) => { e.stopPropagation(); onExecute(); }} className="w-7 h-7 flex items-center justify-center rounded-full active:scale-95 transition-all" style={{ backgroundColor: accentHex, color: "var(--bg-base)" }}>
          <ArrowDownToLine size={14} />
        </button>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="w-7 h-7 flex items-center justify-center rounded-full border active:scale-95 transition-all" style={{ borderColor: "var(--border)", color: "var(--text-dim)", backgroundColor: "var(--bg-base)" }}>
          <ArrowDownToLine size={14} />
        </button>
      )}
      <div className="flex-1 h-px" style={{ backgroundColor: isTarget ? accentHex : "var(--border-dim)" }} />
    </div>
  );
}

function ItemMoveHereButton({ isTarget, onToggle, onExecute, accentHex }: { isTarget: boolean; onToggle: () => void; onExecute: () => void; accentHex: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 px-1 mt-1">
      <div className="flex-1 h-px" style={{ backgroundColor: isTarget ? accentHex : "var(--border-dim)" }} />
      {isTarget ? (
        <button onClick={(e) => { e.stopPropagation(); onExecute(); }} className="w-6 h-6 flex items-center justify-center rounded-full active:scale-95 transition-all" style={{ backgroundColor: accentHex, color: "var(--bg-base)" }}>
          <ArrowDownToLine size={12} />
        </button>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="w-6 h-6 flex items-center justify-center rounded-full border active:scale-95 transition-all" style={{ borderColor: "var(--border)", color: "var(--text-dim)", backgroundColor: "var(--bg-base)" }}>
          <ArrowDownToLine size={12} />
        </button>
      )}
      <div className="flex-1 h-px" style={{ backgroundColor: isTarget ? accentHex : "var(--border-dim)" }} />
    </div>
  );
}
