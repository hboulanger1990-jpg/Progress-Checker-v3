import { Trash2, User as UserIcon, Snail, Search, X, Plus, LockKeyhole, LockKeyholeOpen, CheckSquare, Square, Check, ArrowDownToLine, CloudUpload, LogOut, SunMoon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { AccentColor, Folder, FolderPattern } from "../types";
import { ACCENT_COLORS } from "../types";
import FolderModal from "../modals/FolderModal";
import BackupModal from "../modals/BackupModal";
import { FolderPatternSVG } from "../components/FolderPatternSVG";
import type { User } from "@supabase/supabase-js";

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
  folders: Folder[];
  user: User | null;
  locked: boolean;
  theme: "dark" | "light" | "sepia";
  onToggleTheme: () => void;
  onToggleLock: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSelect: (f: Folder) => void;
  onAdd: (title: string, color: AccentColor, type: "progress" | "read", defaultLabelUnread: string, defaultLabelRead: string, defaultUnit: string, itemSize: "1" | "2" | "full", pattern: FolderPattern) => void;
  onEdit: (id: string, title: string, color: AccentColor, type: "progress" | "read", defaultLabelUnread: string, defaultLabelRead: string, defaultUnit: string, itemSize: "1" | "2" | "full", pattern: FolderPattern) => void;
  onDelete: (id: string) => void;
  onReorder: (newFolders: Folder[]) => void;
  onImport: (data: Folder[]) => void;
}

export default function FolderListScreen({ folders, user, locked, theme, onToggleTheme, onToggleLock, onSignIn, onSignOut, onSelect, onAdd, onEdit, onDelete, onReorder, onImport }: Props) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Folder | null>(null);
  const [showBackup, setShowBackup] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Folder | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveTargetId, setMoveTargetId] = useState<string | "top" | null>(null);
  const [showMoveMode, setShowMoveMode] = useState(false);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressDidFire = useRef(false);

  useEffect(() => {
    if (locked) {
      setSelectMode(false);
      setSelectedIds(new Set());
      setMoveTargetId(null);
      setShowMoveMode(false);
    }
  }, [locked]);

  useEffect(() => {
    if (!selectMode) {
      setMoveTargetId(null);
      setShowMoveMode(false);
    }
  }, [selectMode]);

  const sorted = [...folders];
  const filtered = search ? sorted.filter((f) => f.title.toLowerCase().includes(search.toLowerCase())) : sorted;

  function handleDelete(f: Folder) {
    if (!window.confirm(`「${f.title}」を削除しますか？\n中の全作品も削除されます。`)) return;
    onDelete(f.id);
    setDeleteTarget(null);
  }

  function handleLongPressStart(folder: Folder) {
    if (locked || selectMode) return;
    longPressDidFire.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressDidFire.current = true;
      setEditTarget(folder);
    }, 500);
  }
  function handleLongPressEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
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
    const list = [...sorted];
    const selected = list.filter((f) => selectedIds.has(f.id));
    const notSelected = list.filter((f) => !selectedIds.has(f.id));
    let insertIdx: number;
    if (targetId === "top") {
      insertIdx = 0;
    } else {
      const targetIdx = notSelected.findIndex((f) => f.id === targetId);
      insertIdx = targetIdx === -1 ? notSelected.length : targetIdx + 1;
    }
    const result = [...notSelected.slice(0, insertIdx), ...selected, ...notSelected.slice(insertIdx)];
    onReorder(result);
    setMoveTargetId(null);
  }

  const showMoveButton = showMoveMode && selectedIds.size > 0;

  return (
    <div
      className="min-h-screen flex flex-col"
      onClick={() => { setShowUserMenu(false); }}
    >
      <header className="sticky top-0 z-10 bg-[var(--bg-base)]/95 backdrop-blur-md border-b border-[var(--border-dim)] px-4 pt-2 pb-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold" style={{ color: theme === "sepia" ? "#c0392b" : "var(--text-primary)" }}>Progress Checker</h1>
            <div className="flex items-center gap-2">
              {/* ロックボタン */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
                className="w-9 h-9 flex items-center justify-center rounded-xl border active:scale-95 transition-all"
                style={locked
                  ? { backgroundColor: "#f7768e22", borderColor: "#f7768e", color: "#f7768e" }
                  : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-muted)" }
                }
                title={locked ? "ロック中（タップで解除）" : "ロック"}
              >{locked ? <LockKeyhole size={16} /> : <LockKeyholeOpen size={16} />}</button>

              {/* 選択モードボタン */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (locked) return;
                  if (selectMode) {
                    setSelectMode(false);
                    setSelectedIds(new Set());
                    setMoveTargetId(null);
                  } else {
                    setSelectMode(true);
                  }
                }}
                className="h-9 flex items-center justify-center rounded-xl border active:scale-95 transition-all px-2 gap-1"
                style={selectMode
                  ? { backgroundColor: "#7aa2f7", borderColor: "#7aa2f7", color: "var(--bg-base)" }
                  : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: locked ? "var(--border)" : "var(--text-muted)" }
                }
                title={selectMode ? "選択モード終了" : locked ? "ロック中" : "選択モード"}
              >
                {selectMode ? <Check size={16} /> : <CheckSquare size={16} />}
              </button>

              {/* ユーザーメニュー */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowUserMenu((v) => !v); }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] active:scale-95 transition-transform"
                  style={{ color: user ? "#80c9ca" : "var(--text-muted)" }}
                  title={user ? "メニュー" : "メニュー"}
                >
                  {user ? <Snail size={20} /> : <UserIcon size={20} />}
                </button>
                {showUserMenu && (
                  <div
                    className="absolute right-0 top-11 z-30 bg-[var(--bg-overlay)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden min-w-[160px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {user ? (
                      <button
                        onClick={() => { onSignOut(); setShowUserMenu(false); }}
                        className="w-full px-4 py-3 text-left text-sm text-[var(--text-sub)] hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-2"
                      >
                        <LogOut size={16} /> ログアウト
                      </button>
                    ) : (
                      <button
                        onClick={() => { onSignIn(); setShowUserMenu(false); }}
                        className="w-full px-4 py-3 text-left text-sm text-[var(--text-sub)] hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-2"
                      >
                        <UserIcon size={16} /> ログイン
                      </button>
                    )}
                    <div className="border-t border-[var(--border)]" />
                    <button
                      onClick={() => { onToggleTheme(); setShowUserMenu(false); }}
                      className="w-full px-4 py-3 text-left text-sm text-[var(--text-sub)] hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-2"
                    >
                      <SunMoon size={16} /> モード切替
                    </button>
                    <div className="border-t border-[var(--border)]" />
                    <button
                      onClick={() => { setShowBackup(true); setShowUserMenu(false); }}
                      className="w-full px-4 py-3 text-left text-sm text-[var(--text-sub)] hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-2"
                    >
                      <CloudUpload size={16} /> バックアップ
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 検索バー（選択モード中は不可視で領域確保） */}
          <div style={selectMode ? { visibility: "hidden" } : {}}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><Search size={20} /></span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="フォルダを検索..."
                className="w-full bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#7aa2f7] transition-colors placeholder-[var(--text-dim)]"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><X size={20} /></button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 py-3 max-w-lg mx-auto w-full pb-32">
        {filtered.length === 0 ? (
          <div className="mt-20 text-center space-y-2">
            <p className="text-4xl">📁</p>
            <p className="text-[var(--text-muted)] text-sm">{search ? `「${search}」は見つかりませんでした` : "フォルダがありません"}</p>
            {!search && <p className="text-[var(--text-dim)] text-xs">下のボタンから追加しましょう</p>}
          </div>
        ) : (
          <>
            {/* 選択モード：移動カーソル（先頭） */}
            {showMoveButton && (
              <MoveHereButton
                isTarget={moveTargetId === "top"}
                onToggle={() => setMoveTargetId((v) => v === "top" ? null : "top")}
                onExecute={() => executeMoveHere("top")}
                accentHex="#7aa2f7"
              />
            )}

            {/* 2カラムグリッド */}
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((folder) => {
                const hex = ACCENT_COLORS[folder.accentColor].hex;
                const bgSepia = ACCENT_COLORS[folder.accentColor].bgSepia;
                const isChecked = selectedIds.has(folder.id);
                const pat = (folder.pattern ?? "none") as FolderPattern;
                const workCount = folder.works?.length ?? 0;

                return (
                  <div key={folder.id} className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectMode) { toggleSelectId(folder.id); return; }
                        if (longPressDidFire.current) { longPressDidFire.current = false; return; }
                        onSelect(folder);
                      }}
                      onMouseDown={() => handleLongPressStart(folder)}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                      onTouchStart={() => handleLongPressStart(folder)}
                      onTouchEnd={handleLongPressEnd}
                      onTouchCancel={handleLongPressEnd}
                      onContextMenu={(e) => {
                        if (!selectMode && !locked) {
                          e.preventDefault();
                          setEditTarget(folder);
                        }
                      }}
                      className="w-full text-left active:scale-[0.97] transition-all rounded-2xl overflow-hidden"
                      style={{
                        minHeight: "100px",
                        backgroundColor: theme === "sepia" ? bgSepia : "var(--bg-surface)",
                        border: isChecked
                          ? "1.5px solid #7aa2f7"
                          : `1px solid ${hex}44`,
                        boxShadow: isChecked ? "0 0 0 3px #7aa2f730" : "none",
                        position: "relative",
                        ...(pat === "chevron" ? {
                          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='12' viewBox='0 0 40 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 6.172L6.172 0h5.656L0 11.828V6.172zm40 5.656L28.172 0h5.656L40 6.172v5.656zM6.172 12l12-12h3.656l12 12h-5.656L20 3.828 11.828 12H6.172zm12 0L20 10.172 21.828 12h-3.656z' fill='${encodeURIComponent(hex)}' fill-opacity='0.13' fill-rule='evenodd'/%3E%3C/svg%3E")`,
                        } : pat === "jigsaw" ? {
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 192 192'%3E%3Cpath fill='${encodeURIComponent(hex)}' fill-opacity='0.13' d='M192 15v2a11 11 0 0 0-11 11c0 1.94 1.16 4.75 2.53 6.11l2.36 2.36a6.93 6.93 0 0 1 1.22 7.56l-.43.84a8.08 8.08 0 0 1-6.66 4.13H145v35.02a6.1 6.1 0 0 0 3.03 4.87l.84.43c1.58.79 4 .4 5.24-.85l2.36-2.36a12.04 12.04 0 0 1 7.51-3.11 13 13 0 1 1 .02 26 12 12 0 0 1-7.53-3.11l-2.36-2.36a4.93 4.93 0 0 0-5.24-.85l-.84.43a6.1 6.1 0 0 0-3.03 4.87V143h35.02a8.08 8.08 0 0 1 6.66 4.13l.43.84a6.91 6.91 0 0 1-1.22 7.56l-2.36 2.36A10.06 10.06 0 0 0 181 164a11 11 0 0 0 11 11v2a13 13 0 0 1-13-13 12 12 0 0 1 3.11-7.53l2.36-2.36a4.93 4.93 0 0 0 .85-5.24l-.43-.84a6.1 6.1 0 0 0-4.87-3.03H145v35.02a8.08 8.08 0 0 1-4.13 6.66l-.84.43a6.91 6.91 0 0 1-7.56-1.22l-2.36-2.36A10.06 10.06 0 0 0 124 181a11 11 0 0 0-11 11h-2a13 13 0 0 1 13-13c2.47 0 5.79 1.37 7.53 3.11l2.36 2.36a4.94 4.94 0 0 0 5.24.85l.84-.43a6.1 6.1 0 0 0 3.03-4.87V145h-35.02a8.08 8.08 0 0 1-6.66-4.13l-.43-.84a6.91 6.91 0 0 1 1.22-7.56l2.36-2.36A10.06 10.06 0 0 0 107 124a11 11 0 0 0-22 0c0 1.94 1.16 4.75 2.53 6.11l2.36 2.36a6.93 6.93 0 0 1 1.22 7.56l-.43.84a8.08 8.08 0 0 1-6.66 4.13H49v35.02a6.1 6.1 0 0 0 3.03 4.87l.84.43c1.58.79 4 .4 5.24-.85l2.36-2.36a12.04 12.04 0 0 1 7.51-3.11A13 13 0 0 1 81 192h-2a11 11 0 0 0-11-11c-1.94 0-4.75 1.16-6.11 2.53l-2.36 2.36a6.93 6.93 0 0 1-7.56 1.22l-.84-.43a8.08 8.08 0 0 1-4.13-6.66V145H11.98a6.1 6.1 0 0 0-4.87 3.03l-.43.84c-.79 1.58-.4 4 .85 5.24l2.36 2.36a12.04 12.04 0 0 1 3.11 7.51A13 13 0 0 1 0 177v-2a11 11 0 0 0 11-11c0-1.94-1.16-4.75-2.53-6.11l-2.36-2.36a6.93 6.93 0 0 1-1.22-7.56l.43-.84a8.08 8.08 0 0 1 6.66-4.13H47v-35.02a6.1 6.1 0 0 0-3.03-4.87l-.84-.43c-1.59-.8-4-.4-5.24.85l-2.36 2.36A12 12 0 0 1 28 109a13 13 0 1 1 0-26c2.47 0 5.79 1.37 7.53 3.11l2.36 2.36a4.94 4.94 0 0 0 5.24.85l.84-.43A6.1 6.1 0 0 0 47 84.02V49H11.98a8.08 8.08 0 0 1-6.66-4.13l-.43-.84a6.91 6.91 0 0 1 1.22-7.56l2.36-2.36A10.06 10.06 0 0 0 11 28 11 11 0 0 0 0 17v-2a13 13 0 0 1 13 13c0 2.47-1.37 5.79-3.11 7.53l-2.36 2.36a4.94 4.94 0 0 0-.85 5.24l.43.84A6.1 6.1 0 0 0 11.98 47H47V11.98a8.08 8.08 0 0 1 4.13-6.66l.84-.43a6.91 6.91 0 0 1 7.56 1.22l2.36 2.36A10.06 10.06 0 0 0 68 11 11 11 0 0 0 79 0h2a13 13 0 0 1-13 13 12 12 0 0 1-7.53-3.11l-2.36-2.36a4.93 4.93 0 0 0-5.24-.85l-.84.43A6.1 6.1 0 0 0 49 11.98V47h35.02a8.08 8.08 0 0 1 6.66 4.13l.43.84a6.91 6.91 0 0 1-1.22 7.56l-2.36 2.36A10.06 10.06 0 0 0 85 68a11 11 0 0 0 22 0c0-1.94-1.16-4.75-2.53-6.11l-2.36-2.36a6.93 6.93 0 0 1-1.22-7.56l.43-.84a8.08 8.08 0 0 1 6.66-4.13H143V11.98a6.1 6.1 0 0 0-3.03-4.87l-.84-.43c-1.59-.8-4-.4-5.24.85l-2.36 2.36A12 12 0 0 1 124 13a13 13 0 0 1-13-13h2a11 11 0 0 0 11 11c1.94 0 4.75-1.16 6.11-2.53l2.36-2.36a6.93 6.93 0 0 1 7.56-1.22l.84.43a8.08 8.08 0 0 1 4.13 6.66V47h35.02a6.1 6.1 0 0 0 4.87-3.03l.43-.84c.8-1.59.4-4-.85-5.24l-2.36-2.36A12 12 0 0 1 179 28a13 13 0 0 1 13-13zM84.02 143a6.1 6.1 0 0 0 4.87-3.03l.43-.84c.8-1.59.4-4-.85-5.24l-2.36-2.36A12 12 0 0 1 83 124a13 13 0 1 1 26 0c0 2.47-1.37 5.79-3.11 7.53l-2.36 2.36a4.94 4.94 0 0 0-.85 5.24l.43.84a6.1 6.1 0 0 0 4.87 3.03H143v-35.02a8.08 8.08 0 0 1 4.13-6.66l.84-.43a6.91 6.91 0 0 1 7.56 1.22l2.36 2.36A10.06 10.06 0 0 0 164 107a11 11 0 0 0 0-22c-1.94 0-4.75 1.16-6.11 2.53l-2.36 2.36a6.93 6.93 0 0 1-7.56 1.22l-.84-.43a8.08 8.08 0 0 1-4.13-6.66V49h-35.02a6.1 6.1 0 0 0-4.87 3.03l-.43.84c-.79 1.58-.4 4 .85 5.24l2.36 2.36a12.04 12.04 0 0 1 3.11 7.51A13 13 0 1 1 83 68a12 12 0 0 1 3.11-7.53l2.36-2.36a4.93 4.93 0 0 0 .85-5.24l-.43-.84A6.1 6.1 0 0 0 84.02 49H49v35.02a8.08 8.08 0 0 1-4.13 6.66l-.84.43a6.91 6.91 0 0 1-7.56-1.22l-2.36-2.36A10.06 10.06 0 0 0 28 85a11 11 0 0 0 0 22c1.94 0 4.75-1.16 6.11-2.53l2.36-2.36a6.93 6.93 0 0 1 7.56-1.22l.84.43a8.08 8.08 0 0 1 4.13 6.66V143h35.02z'/%3E%3C/svg%3E")`,
                        } : pat === "hexagon" ? {
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='29' viewBox='0 0 40 59.428'%3E%3Cpath fill='none' stroke='${encodeURIComponent(hex)}' stroke-opacity='${theme === "dark" ? "0.13" : "0.35"}' stroke-linecap='square' stroke-width='3' d='M0 70.975V47.881m20-1.692L8.535 52.808v13.239L20 72.667l11.465-6.62V52.808zm0-32.95 11.465-6.62V-6.619L20-13.24 8.535-6.619V6.619L20 13.24m8.535 4.927v13.238L40 38.024l11.465-6.62V18.166L40 11.546zM20 36.333 0 47.88m0 0v23.094m0 0 20 11.548 20-11.548V47.88m0 0L20 36.333m0 0 20 11.549M0 11.547l-11.465 6.619v13.239L0 38.025l11.465-6.62v-13.24L0 11.548v-23.094l20-11.547 20 11.547v23.094M20 36.333V13.24'/%3E%3C/svg%3E")`,
                        } : {}),
                      }}
                    >
                      {/* グラデーション背景 */}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          zIndex: 1,
                          background: `linear-gradient(120deg, ${hex}60 0%, transparent 60%)`,
                          pointerEvents: "none",
                        }}
                      />

                      {/* 左アクセントバー */}
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          left: 0,
                          width: "3px",
                          backgroundColor: hex,
                          borderRadius: "2px 0 0 2px",
                          zIndex: 2,
                        }}
                      />

                      {/* SVGパターン（chevron/jigsaw/hexagon以外） */}
                      {pat !== "none" && pat !== "chevron" && pat !== "jigsaw" && pat !== "hexagon" && (
                        <svg
                          viewBox="0 0 150 100"
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            pointerEvents: "none",
                          }}
                        >
                          <FolderPatternSVG pattern={pat} hex={hex} />
                        </svg>
                      )}

                      {/* コンテンツ */}
                      <div
                        style={{
                          position: "relative",
                          zIndex: 1,
                          padding: "10px 10px 10px 14px",
                          display: "flex",
                          flexDirection: "column",
                          minHeight: "100px",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                          {selectMode && (
                            <span className="shrink-0 mt-0.5" style={{ color: isChecked ? "#7aa2f7" : "var(--text-dim)" }}>
                              {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                            </span>
                          )}
                          <span
                            className="font-bold leading-tight"
                            style={{
                              color: "var(--text-primary)",
                              fontSize: "13px",
                              wordBreak: "break-all",
                            }}
                          >
                            {folder.title}
                          </span>
                        </div>

                        {/* 作品数 */}
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            marginTop: "8px",
                          }}
                        >
                          {workCount}作品
                        </div>
                      </div>
                    </button>

                    {/* 選択モード：移動カーソル（各カードの下） */}
                    {showMoveButton && !isChecked && (
                      <MoveHereButton
                        isTarget={moveTargetId === folder.id}
                        onToggle={() => setMoveTargetId((v) => v === folder.id ? null : folder.id)}
                        onExecute={() => executeMoveHere(folder.id)}
                        accentHex="#7aa2f7"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* フッター：選択モード */}
      {!locked && selectMode && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)]/90 to-transparent">
          <div className="max-w-lg mx-auto flex gap-2">
            <button
              onClick={() => { setShowMoveMode((v) => !v); setMoveTargetId(null); }}
              disabled={selectedIds.size === 0}
              className="flex-1 py-3 rounded-2xl border text-sm font-medium active:scale-95 transition-transform flex items-center justify-center gap-2"
              style={showMoveMode
                ? { backgroundColor: "#7aa2f7", borderColor: "#7aa2f7", color: "var(--bg-base)" }
                : selectedIds.size === 0
                  ? { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--border)" }
                  : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-sub)" }
              }
            ><ArrowDownToLine size={16} /> 移動</button>
            {selectedIds.size > 0 && (
              <button
                onClick={() => {
                  const targets = folders.filter(f => selectedIds.has(f.id));
                  const names = targets.map(f => `「${f.title}」`).join("、");
                  if (!window.confirm(`${names}を削除しますか？\n中の全作品も削除されます。`)) return;
                  targets.forEach(f => onDelete(f.id));
                  setSelectedIds(new Set());
                  setSelectMode(false);
                }}
                className="py-3 px-5 rounded-2xl border text-sm font-medium active:scale-95 transition-transform flex items-center justify-center gap-2"
                style={{ backgroundColor: "#f7768e22", borderColor: "#f7768e", color: "#f7768e" }}
              ><Trash2 size={16} /> 削除</button>
            )}
          </div>
        </div>
      )}

      {/* フッター：通常 */}
      {!locked && !selectMode && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)]/90 to-transparent">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => setShowAdd(true)}
              className="w-full font-bold py-4 rounded-2xl text-base shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              style={{ backgroundColor: theme === "sepia" ? "#7aa2f7" : mixWithGray("#7aa2f7", theme, 0.3), color: "var(--bg-base)", boxShadow: "0 4px 24px #7aa2f733" }}
            >
              <Plus size={20} /><span>新しいフォルダを追加</span>
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <FolderModal mode="add" onClose={() => setShowAdd(false)}
          onSave={(title, color, type, dlu, dlr, du, itemSize, pattern) => {
            onAdd(title, color, type, dlu, dlr, du, itemSize, pattern);
            setShowAdd(false);
          }} />
      )}
      {editTarget && (
        <FolderModal mode="edit" initial={editTarget} onClose={() => setEditTarget(null)}
          onSave={(title, color, type, dlu, dlr, du, itemSize, pattern) => {
            onEdit(editTarget.id, title, color, type, dlu, dlr, du, itemSize, pattern);
            setEditTarget(null);
          }} />
      )}
      {showBackup && (
        <BackupModal data={folders} onClose={() => setShowBackup(false)} onImport={onImport} />
      )}
    </div>
  );
}

function MoveHereButton({ isTarget, onToggle, onExecute, accentHex }: { isTarget: boolean; onToggle: () => void; onExecute: () => void; accentHex: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 px-1 col-span-2">
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
