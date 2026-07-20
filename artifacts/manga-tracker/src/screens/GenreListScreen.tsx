import { Pencil, Trash2, ArrowLeft, Plus, ListChecks, CheckSquare, Square, Check, Combine } from "lucide-react";
import { useState, useEffect } from "react";
import type { Folder } from "../types";
import { ACCENT_COLORS } from "../types";
import GenreModal from "../modals/GenreModal";
import FolderPickerModal from "../modals/FolderPickerModal";

interface Props {
  folder: Folder;
  allFolders: Folder[];
  theme: "dark" | "light" | "sepia";
  locked: boolean;
  onBack: () => void;
  /** genre === null は「未分類」を選んだことを示す */
  onSelectGenre: (genre: string | null) => void;
  onAddGenre: (name: string) => void;
  onEditGenre: (oldName: string, newName: string) => void;
  onDeleteGenre: (name: string) => void;
  onMergeGenres: (genreNames: string[], targetFolderId: string) => void;
}

export default function GenreListScreen({
  folder, allFolders, theme, locked, onBack, onSelectGenre, onAddGenre, onEditGenre, onDeleteGenre, onMergeGenres,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [showMergePicker, setShowMergePicker] = useState(false);

  useEffect(() => {
    if (locked) {
      setSelectMode(false);
      setSelectedGenres(new Set());
      setShowMergePicker(false);
    }
  }, [locked]);

  useEffect(() => {
    if (!selectMode) {
      setSelectedGenres(new Set());
      setShowMergePicker(false);
    }
  }, [selectMode]);

  const folderHex = ACCENT_COLORS[folder.accentColor].hex;
  const genres = folder.genres ?? [];

  const countFor = (g: string) => folder.works.filter((w) => w.genre === g).length;
  const unclassifiedCount = folder.works.filter((w) => !w.genre || !genres.includes(w.genre)).length;

  const isEmpty = genres.length === 0 && unclassifiedCount === 0;

  function toggleSelect(g: string) {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  }

  const mergeTargetFolders = allFolders.filter((f) => f.id !== folder.id);

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{ background: "var(--bg-gradient)" }}
    >
      <header
        className="sticky top-0 z-10 backdrop-blur-md border-b px-4 pt-2 pb-3"
        style={{ backgroundColor: "color-mix(in srgb, var(--bg-base) 95%, transparent)", borderColor: "var(--border-dim)" }}
      >
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={onBack}
            className="shrink-0 flex items-center gap-1 text-sm font-medium active:scale-95 transition-transform py-1 pr-2"
            style={{ color: folderHex }}
          >
            <ArrowLeft size={20} /><span>戻る</span>
          </button>
          <h1
            className="flex-1 font-bold text-base truncate"
            style={{ color: theme === "sepia" ? "#c0392b" : "var(--text-primary)" }}
          >
            {folder.title}
          </h1>
          {!locked && genres.length > 0 && (
            <button
              onClick={() => setSelectMode((v) => !v)}
              className="shrink-0 h-8 flex items-center justify-center rounded-lg border active:scale-95 transition-all px-2 gap-1"
              style={selectMode
                ? { backgroundColor: "var(--accent-primary)", borderColor: "var(--accent-primary)", color: "var(--bg-base)" }
                : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-muted)" }
              }
              title={selectMode ? "選択モード終了" : "選択モード"}
            >
              {selectMode ? <Check size={14} /> : <CheckSquare size={14} />}
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-3 max-w-lg mx-auto w-full pb-32">
        {isEmpty ? (
          <div className="mt-20 text-center space-y-2">
            <div className="flex justify-center" style={{ color: "var(--text-muted)" }}><ListChecks size={40} /></div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>ジャンルがありません</p>
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>下のボタンから追加しましょう</p>
          </div>
        ) : (
          <div className="space-y-2">
            {genres.map((g) => (
              <GenreCard
                key={g}
                label={g}
                count={countFor(g)}
                hex={folderHex}
                locked={locked}
                selectMode={selectMode}
                isChecked={selectedGenres.has(g)}
                onClick={() => {
                  if (selectMode) { toggleSelect(g); return; }
                  onSelectGenre(g);
                }}
                onEdit={() => setEditTarget(g)}
                onDelete={() => {
                  const n = countFor(g);
                  const message = n > 0
                    ? `「${g}」と中の${n}作品を削除しますか？\nこの操作は元に戻せません。`
                    : `「${g}」を削除しますか？\nこの操作は元に戻せません。`;
                  if (window.confirm(message)) {
                    onDeleteGenre(g);
                  }
                }}
              />
            ))}
            {unclassifiedCount > 0 && (
              <GenreCard
                label="未分類"
                count={unclassifiedCount}
                hex={folderHex}
                locked={locked}
                muted
                onClick={() => { if (!selectMode) onSelectGenre(null); }}
              />
            )}
          </div>
        )}
      </main>

      {!locked && !selectMode && (
        <div
          className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
          style={{ background: `linear-gradient(to top, var(--bg-base) 60%, transparent)` }}
        >
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => setShowAdd(true)}
              className="w-full font-bold py-4 rounded-2xl text-base shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              style={{ backgroundColor: folderHex, color: "var(--bg-base)", boxShadow: `0 4px 24px ${folderHex}33` }}
            >
              <Plus size={20} /><span>新しいジャンルを追加</span>
            </button>
          </div>
        </div>
      )}

      {!locked && selectMode && (
        <div
          className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
          style={{ background: `linear-gradient(to top, var(--bg-base) 60%, transparent)` }}
        >
          <div className="max-w-lg mx-auto flex gap-2">
            <button
              onClick={() => setShowMergePicker(true)}
              disabled={selectedGenres.size === 0}
              className="flex-1 py-3 rounded-2xl border text-sm font-medium active:scale-95 transition-transform flex items-center justify-center gap-2"
              style={selectedGenres.size === 0
                ? { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--border)" }
                : { backgroundColor: "#9ece6a22", borderColor: "#9ece6a", color: "#9ece6a" }
              }
            ><Combine size={16} /> 統合</button>
          </div>
        </div>
      )}

      {showAdd && (
        <GenreModal
          mode="add"
          existingGenres={genres}
          onClose={() => setShowAdd(false)}
          onSave={(name) => { onAddGenre(name); setShowAdd(false); }}
        />
      )}
      {editTarget && (
        <GenreModal
          mode="edit"
          initial={editTarget}
          existingGenres={genres}
          onClose={() => setEditTarget(null)}
          onSave={(name) => { onEditGenre(editTarget, name); setEditTarget(null); }}
        />
      )}
      {showMergePicker && (
        <FolderPickerModal
          folders={mergeTargetFolders}
          title="統合先のフォルダを選択"
          description="選択したジャンルの作品が、選んだフォルダに移動します。統合元のジャンルはこのフォルダから無くなります。"
          onClose={() => setShowMergePicker(false)}
          onSelect={(targetId) => {
            const names = Array.from(selectedGenres).map((g) => `「${g}」`).join("、");
            const destName = allFolders.find((f) => f.id === targetId)?.title ?? "";
            if (!window.confirm(`${names}を「${destName}」に統合しますか？`)) return;
            onMergeGenres(Array.from(selectedGenres), targetId);
            setShowMergePicker(false);
            setSelectedGenres(new Set());
            setSelectMode(false);
          }}
        />
      )}
    </div>
  );
}

function GenreCard({
  label, count, hex, muted, locked, selectMode, isChecked, onClick, onEdit, onDelete,
}: {
  label: string;
  count: number;
  hex: string;
  muted?: boolean;
  locked?: boolean;
  selectMode?: boolean;
  isChecked?: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const showActions = !muted && !locked && !selectMode && (onEdit || onDelete);
  return (
    <div
      className="rounded-2xl border overflow-hidden flex items-stretch"
      style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <button
        onClick={onClick}
        disabled={muted && selectMode}
        className="flex-1 min-w-0 text-left px-4 py-4 active:scale-[0.99] transition-transform flex items-center justify-between gap-3"
      >
        <span className="flex items-center gap-2 min-w-0">
          {selectMode && !muted && (
            <span className="shrink-0" style={{ color: isChecked ? "var(--accent-primary)" : "var(--text-dim)" }}>
              {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
            </span>
          )}
          <span
            className="font-bold text-base truncate"
            style={{ color: muted ? "var(--text-muted)" : "var(--text-primary)" }}
          >
            {label}
          </span>
        </span>
        <span className="text-sm font-medium shrink-0" style={{ color: hex }}>{count}作品</span>
      </button>

      {showActions && (
        <div className="flex items-center gap-1 pr-3 pl-1 shrink-0">
          {onEdit && (
            <button
              onClick={onEdit}
              className="w-7 h-7 flex items-center justify-center rounded-lg active:scale-95 transition-transform"
              style={{ color: "var(--text-dim)" }}
              title="編集"
            ><Pencil size={14} /></button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="w-7 h-7 flex items-center justify-center rounded-lg active:scale-95 transition-transform"
              style={{ color: "#f7768e" }}
              title="削除"
            ><Trash2 size={14} /></button>
          )}
        </div>
      )}
    </div>
  );
}
