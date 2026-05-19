import { Pencil, Trash2, User as UserIcon, Snail, Search, X, Plus, LockKeyhole, LockKeyholeOpen, CheckSquare, Square, Check, ArrowDownToLine, CloudUpload, LogOut, SunMoon, Folder as FolderIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { AccentColor, Folder } from "../types";
import { ACCENT_COLORS } from "../types";
import FolderModal from "../modals/FolderModal";

function mixWithGray(hex: string, theme: "dark" | "light", ratio: number): string {
  const gray = theme === "dark" ? 0x78 : 0xbe;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r + (gray - r) * ratio);
  const ng = Math.round(g + (gray - g) * ratio);
  const nb = Math.round(b + (gray - b) * ratio);
  return `rgb(${nr},${ng},${nb})`;
}
import BackupModal from "../modals/BackupModal";
import type { User } from "@supabase/supabase-js";

interface Props {
  folders: Folder[];
  user: User | null;
  locked: boolean;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onToggleLock: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSelect: (f: Folder) => void;
  onAdd: (title: string, color: AccentColor, type: "progress" | "read", defaultLabelUnread: string, defaultLabelRead: string, defaultUnit: string, itemSize: "1" | "2" | "full") => void;
  onEdit: (id: string, title: string, color: AccentColor, type: "progress" | "read", defaultLabelUnread: string, defaultLabelRead: string, defaultUnit: string, itemSize: "1" | "2" | "full") => void;
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

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveTargetId, setMoveTargetId] = useState<string | "top" | null>(null);
  const [showMoveMode, setShowMoveMode] = useState(false);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    }
  }, [selectMode]);

  // 登録順のまま（updatedAtでソートしない）
  const sorted = [...folders];
  const filtered = search ? sorted.filter((f) => f.title.toLowerCase().includes(search.toLowerCase())) : sorted;

  function handleDelete(f: Folder) {
    if (!window.confirm(`「${f.title}」を削除しますか？\n中の全作品も削除されます。`)) return;
    onDelete(f.id);
    setSelectedId(null);
  }

  function handlePressStart(id: string) {
    if (locked || selectMode) return;
    longPressTimer.current = setTimeout(() => setSelectedId(id), 500);
  }
  function handlePressEnd() {
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
  const addButtonColor = mixWithGray("#7aa2f7", theme, 0.3);

  return (
    <div
      className="min-h-screen flex flex-col"
      onClick={() => { setSelectedId(null); setShowUserMenu(false); }}
    >
      <header className="sticky top-0 z-10 bg-[var(--bg-base)]/95 backdrop-blur-md border-b border-[var(--border-dim)] px-4 pt-2 pb-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Progress Checker</h1>
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
                    setSelectedId(null);
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

              {/* ユーザーメニューボタン */}
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
                      <SunMoon size={16} /> ライト／ダーク
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

          {/* 検索バー */}
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

      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full pb-32">
        {filtered.length === 0 ? (
          <div className="mt-20 text-center space-y-2">
            <p className="text-4xl">📁</p>
            <p className="text-[var(--text-muted)] text-sm">{search ? `「${search}」は見つかりませんでした` : "フォルダがありません"}</p>
            {!search && <p className="text-[var(--text-dim)] text-xs">下のボタンから追加しましょう</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {showMoveButton && (
              <MoveHereButton
                isTarget={moveTargetId === "top"}
                onToggle={() => setMoveTargetId((v) => v === "top" ? null : "top")}
                onExecute={() => executeMoveHere("top")}
                accentHex="#7aa2f7"
              />
            )}
            
            {/* 2列のグリッドレイアウトへ昇華 */}
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((folder) => {
                const hex = ACCENT_COLORS[folder.accentColor].hex;
                const isSelected = selectedId === folder.id;
                const isChecked = selectedIds.has(folder.id);
                
                // テーマに合わせた背景グラデーションを動的に生成 (不透明度10%〜15%程度)
                const gradColor = theme === "dark" ? `${hex}1a` : `${hex}22`;
                const bgGradient = `linear-gradient(135deg, ${gradColor} 0%, var(--bg-surface) 60%)`;

                return (
                  <div key={folder.id} className="relative flex flex-col justify-stretch">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectMode) { toggleSelectId(folder.id); return; }
                        if (isSelected) { setSelectedId(null); return; }
                        onSelect(folder);
                      }}
                      onMouseDown={() => { if (!selectMode) handlePressStart(folder.id); }}
                      onMouseUp={handlePressEnd}
                      onMouseLeave={handlePressEnd}
                      onTouchStart={() => { if (!selectMode) handlePressStart(folder.id); }}
                      onTouchEnd={handlePressEnd}
                      onContextMenu={(e) => { if (!selectMode && !locked) { e.preventDefault(); setSelectedId(folder.id); } }}
                      className={`w-full flex-1 border rounded-2xl p-4 text-left active:scale-[0.97] hover:translate-y-[-1px] transition-all flex flex-col gap-3 shadow-sm ${
                        isChecked || isSelected 
                          ? "border-[#7aa2f7] ring-2 ring-[#7aa2f7]/20" 
                          : "border-[var(--border-dim)] hover:border-[var(--border)]"
                      }`}
                      style={{ 
                        background: bgGradient,
                        borderLeftColor: hex, 
                        borderLeftWidth: "4px" 
                      }}
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        {/* フォルダを象徴するアイコンを追加して「アプリ感」を向上 */}
                        <FolderIcon size={18} style={{ color: hex }} className="shrink-0" />
                        
                        {selectMode && (
                          <span className="shrink-0" style={{ color: isChecked ? "#7aa2f7" : "var(--text-dim)" }}>
                            {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                          </span>
                        )}
                      </div>
                      
                      <span className="font-bold text-[var(--text-primary)] text-sm sm:text-base leading-snug flex-1 tracking-wide mt-1 break-all">
                        {folder.title}
                      </span>
                    </button>

                    {/* 長押し時の編集・削除メニュー（グリッド用に最適化） */}
                    {isSelected && !selectMode && !locked && (
                      <div className="absolute inset-0 z-20 flex flex-col gap-1.5 p-2 bg-[var(--bg-overlay)]/95 backdrop-blur-sm rounded-2xl justify-center items-center border border-[#7aa2f7]" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { setEditTarget(folder); setSelectedId(null); }} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl bg-[var(--bg-surface)] border border-[#7aa2f7] text-[#7aa2f7] active:scale-95 transition-transform shadow-md"><Pencil size={14} /> 編集</button>
                        <button onClick={() => handleDelete(folder)} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl bg-[var(--bg-surface)] border border-[#f7768e] text-[#f7768e] active:scale-95 transition-transform shadow-md"><Trash2 size={14} /> 削除</button>
                      </div>
                    )}

                    {showMoveButton && !isChecked && (
                      <div className="mt-2 w-full">
                        <MoveHereButton
                          isTarget={moveTargetId === folder.id}
                          onToggle={() => setMoveTargetId((v) => v === folder.id ? null : folder.id)}
                          onExecute={() => executeMoveHere(folder.id)}
                          accentHex="#7aa2f7"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

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
          </div>
        </div>
      )}
      
      {!locked && !selectMode && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)]/90 to-transparent">
          <div className="max-w-lg mx-auto">
            {/* 追加ボタンをモダンな「光るアウトライン（ゴースト）スタイル」へ */}
            <button
              onClick={() => setShowAdd(true)}
              className="w-full font-bold py-3.5 rounded-2xl text-base border-2 shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-overlay)]"
              style={{ 
                borderColor: addButtonColor, 
                color: addButtonColor,
                boxShadow: `0 4px 20px ${addButtonColor}11`
              }}
            >
              <Plus size={20} /><span>新しいフォルダを追加</span>
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <FolderModal mode="add" onClose={() => setShowAdd(false)}
          onSave={(title, color, type, dlu, dlr, du, itemSize) => { onAdd(title, color, type, dlu, dlr, du, itemSize); setShowAdd(false); }} />
      )}
      {editTarget && (
        <FolderModal mode="edit" initial={editTarget} onClose={() => setEditTarget(null)}
          onSave={(title, color, type, dlu, dlr, du, itemSize) => { onEdit(editTarget.id, title, color, type, dlu, dlr, du, itemSize); setEditTarget(null); }} />
      )}
      {showBackup && (
        <BackupModal data={folders} onClose={() => setShowBackup(false)} onImport={onImport} />
      )}
    </div>
  );
}

function MoveHereButton({ isTarget, onToggle, onExecute, accentHex }: { isTarget: boolean; onToggle: () => void; onExecute: () => void; accentHex: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 px-1 w-full">
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