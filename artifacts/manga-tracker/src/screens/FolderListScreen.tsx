import { Pencil, Trash2, User as UserIcon, Snail, Search, X, Plus, LockKeyhole, LockKeyholeOpen, CheckSquare, Square, Check, ArrowDownToLine, CloudUpload, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { AccentColor, Folder } from "../types";
import { ACCENT_COLORS } from "../types";
import FolderModal from "../modals/FolderModal";
import BackupModal from "../modals/BackupModal";
import type { User } from "@supabase/supabase-js";

interface Props {
  folders: Folder[];
  user: User | null;
  locked: boolean;
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

export default function FolderListScreen({ folders, user, locked, onToggleLock, onSignIn, onSignOut, onSelect, onAdd, onEdit, onDelete, onReorder, onImport }: Props) {
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

  return (
    <div
      className="min-h-screen bg-[#1a1b26] flex flex-col"
      onClick={() => { setSelectedId(null); setShowUserMenu(false); }}
    >
      <header className="sticky top-0 z-10 bg-[#1a1b26]/95 backdrop-blur-md border-b border-[#2a2d3e] px-4 pt-2 pb-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-[#c0caf5]">Progress Checker</h1>
            <div className="flex items-center gap-2">
              {/* ロックボタン */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
                className="w-9 h-9 flex items-center justify-center rounded-xl border active:scale-95 transition-all"
                style={locked
                  ? { backgroundColor: "#f7768e22", borderColor: "#f7768e", color: "#f7768e" }
                  : { backgroundColor: "#24283b", borderColor: "#3b4261", color: "#787c99" }
                }
                title={locked ? "ロック中（タップで解除）" : "ロック"}
              >{locked ? <LockKeyhole size={16} /> : <LockKeyholeOpen size={16} />}</button>

              {/* 選択モードボタン（常に表示、ロック中は薄く） */}
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
                  ? { backgroundColor: "#7aa2f7", borderColor: "#7aa2f7", color: "#1a1b26" }
                  : { backgroundColor: "#24283b", borderColor: "#3b4261", color: locked ? "#3b4261" : "#787c99" }
                }
                title={selectMode ? "完了" : locked ? "ロック中" : "選択モード"}
              >
                {selectMode
                  ? <><Check size={14} /><span className="text-xs font-bold">完了</span></>
                  : <CheckSquare size={16} />
                }
              </button>

              {/* ユーザーメニューボタン（バックアップ統合） */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowUserMenu((v) => !v); }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#24283b] border border-[#3b4261] active:scale-95 transition-transform"
                  style={{ color: user ? "#80c9ca" : "#787c99" }}
                  title={user ? "メニュー" : "メニュー"}
                >
                  {user ? <Snail size={20} /> : <UserIcon size={20} />}
                </button>
                {showUserMenu && (
                  <div
                    className="absolute right-0 top-11 z-30 bg-[#1f2335] border border-[#3b4261] rounded-xl shadow-2xl overflow-hidden min-w-[160px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {user ? (
                      <button
                        onClick={() => { onSignOut(); setShowUserMenu(false); }}
                        className="w-full px-4 py-3 text-left text-sm text-[#a9b1d6] hover:bg-[#24283b] transition-colors flex items-center gap-2"
                      >
                        <LogOut size={16} /> ログアウト
                      </button>
                    ) : (
                      <button
                        onClick={() => { onSignIn(); setShowUserMenu(false); }}
                        className="w-full px-4 py-3 text-left text-sm text-[#a9b1d6] hover:bg-[#24283b] transition-colors flex items-center gap-2"
                      >
                        <UserIcon size={16} /> ログイン
                      </button>
                    )}
                    <div className="border-t border-[#3b4261]" />
                    <button
                      onClick={() => { setShowBackup(true); setShowUserMenu(false); }}
                      className="w-full px-4 py-3 text-left text-sm text-[#a9b1d6] hover:bg-[#24283b] transition-colors flex items-center gap-2"
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
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#787c99]"><Search size={20} /></span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="フォルダを検索..."
                className="w-full bg-[#24283b] text-[#c0caf5] border border-[#3b4261] rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#7aa2f7] transition-colors placeholder-[#4a5177]"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#787c99]"><X size={20} /></button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-3 max-w-lg mx-auto w-full pb-32">
        {filtered.length === 0 ? (
          <div className="mt-20 text-center space-y-2">
            <p className="text-4xl">📁</p>
            <p className="text-[#787c99] text-sm">{search ? `「${search}」は見つかりませんでした` : "フォルダがありません"}</p>
            {!search && <p className="text-[#4a5177] text-xs">下のボタンから追加しましょう</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {showMoveButton && (
              <MoveHereButton
                isTarget={moveTargetId === "top"}
                onToggle={() => setMoveTargetId((v) => v === "top" ? null : "top")}
                onExecute={() => executeMoveHere("top")}
                accentHex="#7aa2f7"
              />
            )}
            {filtered.map((folder) => {
              const hex = ACCENT_COLORS[folder.accentColor].hex;
              const isSelected = selectedId === folder.id;
              const isChecked = selectedIds.has(folder.id);
              return (
                <div key={folder.id} className="relative">
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
                    className={`w-full bg-[#24283b] border rounded-2xl px-4 py-3.5 text-left active:scale-[0.98] transition-all flex items-center gap-3 ${isChecked || isSelected ? "border-[#7aa2f7] ring-2 ring-[#7aa2f7]/30" : "border-[#3b4261]"}`}
                    style={{ borderLeftColor: hex, borderLeftWidth: "4px" }}
                  >
                    {selectMode && (
                      <span className="shrink-0" style={{ color: isChecked ? "#7aa2f7" : "#4a5177" }}>
                        {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                      </span>
                    )}
                    <span className="font-bold text-[#c0caf5] text-base leading-tight flex-1">{folder.title}</span>
                  </button>
                  {isSelected && !selectMode && !locked && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-0 z-20 flex gap-2 p-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { setEditTarget(folder); setSelectedId(null); }} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-[#24283b] border border-[#7aa2f7] text-[#7aa2f7] active:scale-95 transition-transform shadow-lg"><Pencil size={16} /> 編集</button>
                      <button onClick={() => handleDelete(folder)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-[#24283b] border border-[#f7768e] text-[#f7768e] active:scale-95 transition-transform shadow-lg"><Trash2 size={16} /> 削除</button>
                    </div>
                  )}
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
        )}
      </main>

      {!locked && selectMode && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[#1a1b26] via-[#1a1b26]/90 to-transparent">
          <div className="max-w-lg mx-auto flex gap-2">
            <button
              onClick={() => { setShowMoveMode((v) => !v); setMoveTargetId(null); }}
              disabled={selectedIds.size === 0}
              className="flex-1 py-3 rounded-2xl border text-sm font-medium active:scale-95 transition-transform flex items-center justify-center gap-2"
              style={showMoveMode
                ? { backgroundColor: "#7aa2f7", borderColor: "#7aa2f7", color: "#1a1b26" }
                : selectedIds.size === 0
                  ? { backgroundColor: "#24283b", borderColor: "#3b4261", color: "#3b4261" }
                  : { backgroundColor: "#24283b", borderColor: "#3b4261", color: "#a9b1d6" }
              }
            ><ArrowDownToLine size={16} /> 移動</button>
          </div>
        </div>
      )}
      {!locked && !selectMode && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[#1a1b26] via-[#1a1b26]/90 to-transparent">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => setShowAdd(true)}
              className="w-full bg-[#7aa2f7] text-[#1a1b26] font-bold py-4 rounded-2xl text-base shadow-lg shadow-[#7aa2f7]/20 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
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
    <div className="flex items-center gap-2 py-0.5 px-1">
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
