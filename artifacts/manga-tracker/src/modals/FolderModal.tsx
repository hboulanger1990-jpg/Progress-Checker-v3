import { useState, useEffect, useRef } from "react";
import type { AccentColor, Folder } from "../types";
import { ACCENT_COLORS } from "../types";

interface Props {
  mode: "add" | "edit";
  initial?: Folder;
  onClose: () => void;
  onSave: (
    title: string,
    color: AccentColor,
    type: "progress" | "read",
    defaultLabelUnread: string,
    defaultLabelRead: string,
    defaultUnit: string,
    itemSize: "1" | "2" | "full"
  ) => void;
}

const COLOR_KEYS = Object.keys(ACCENT_COLORS) as AccentColor[];

export default function FolderModal({ mode, initial, onClose, onSave }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [color, setColor] = useState<AccentColor>(initial?.accentColor ?? "blue");
  const [folderType, setFolderType] = useState<"progress" | "read">(initial?.type ?? "progress");
  const [defaultLabelUnread, setDefaultLabelUnread] = useState(initial?.defaultLabelUnread ?? "");
  const [defaultLabelRead, setDefaultLabelRead] = useState(initial?.defaultLabelRead ?? "");
  const [defaultUnit, setDefaultUnit] = useState(initial?.defaultUnit ?? "");
  const [itemSize, setItemSize] = useState<"1" | "2" | "full">(initial?.itemSize ?? "full");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  useEffect(() => {
    const handler = (e: Event) => { e.stopImmediatePropagation(); };
    document.addEventListener("visibilitychange", handler, true);
    return () => document.removeEventListener("visibilitychange", handler, true);
  }, []);

  function handleSave() {
    const t = title.trim();
    if (!t) { setError("タイトルを入力してください"); return; }
    onSave(t, color, folderType, defaultLabelUnread.trim(), defaultLabelRead.trim(), defaultUnit.trim(), itemSize);
  }

  const inputClass = "w-full bg-[#24283b] text-[#c0caf5] border border-[#3b4261] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#7aa2f7] transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-sm bg-[#1f2335] border border-[#3b4261] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl overflow-y-auto"
        style={{ maxHeight: "90dvh" }}
      >
        {/* タイトル行 + ボタン */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="text-lg font-bold text-[#c0caf5]">
            {mode === "add" ? "フォルダを追加" : "フォルダを編集"}
          </h2>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-[#3b4261] text-[#787c99] text-sm font-medium active:scale-95 transition-transform"
            >
              戻る
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded-xl bg-[#7aa2f7] text-[#1a1b26] text-sm font-bold active:scale-95 transition-transform"
            >
              {mode === "add" ? "追加" : "保存"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#787c99] mb-1">フォルダ名</label>
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs text-[#787c99] mb-2">管理タイプ</label>
            <div className="grid grid-cols-2 gap-2">
              {(["progress", "read"] as const).map((t) => {
                const isSelected = folderType === t;
                const label = t === "progress" ? "進捗" : "完了";
                return (
                  <button
                    key={t}
                    onClick={() => setFolderType(t)}
                    className="rounded-xl border p-3 text-center transition-all active:scale-95"
                    style={{
                      borderColor: isSelected ? ACCENT_COLORS[color].hex : "#3b4261",
                      backgroundColor: isSelected ? `${ACCENT_COLORS[color].hex}22` : "#24283b",
                    }}
                  >
                    <div className="text-sm font-bold" style={{ color: isSelected ? ACCENT_COLORS[color].hex : "#c0caf5" }}>
                      {label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#787c99] mb-2">アクセントカラー</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_KEYS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-10 h-10 rounded-full transition-transform active:scale-90"
                  style={{
                    backgroundColor: ACCENT_COLORS[c].hex,
                    outline: color === c ? `3px solid ${ACCENT_COLORS[c].hex}` : "none",
                    outlineOffset: 2,
                    opacity: color === c ? 1 : 0.5,
                  }}
                  aria-label={ACCENT_COLORS[c].label}
                />
              ))}
            </div>
          </div>

          {folderType === "progress" && (
            <div className="border-t border-[#3b4261] pt-4">
              <p className="text-xs text-[#787c99] mb-3">新規作品のデフォルト設定（省略可）</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-[#787c99] mb-1">未完了ラベル</label>
                  <input value={defaultLabelUnread} onChange={(e) => setDefaultLabelUnread(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-[#787c99] mb-1">完了ラベル</label>
                  <input value={defaultLabelRead} onChange={(e) => setDefaultLabelRead(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#787c99] mb-1">単位</label>
                <input value={defaultUnit} onChange={(e) => setDefaultUnit(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {folderType === "read" && (
  <div className="border-t border-[#3b4261] pt-4">
    <p className="text-xs text-[#787c99] mb-3">ステータスラベル（省略可）</p>
    <div className="grid grid-cols-2 gap-3 mb-4">
      <div>
        <label className="block text-xs text-[#787c99] mb-1">未完了ラベル</label>
        <input value={defaultLabelUnread} onChange={(e) => setDefaultLabelUnread(e.target.value)} placeholder="未完了" className={`${inputClass} placeholder-[#4a5177]`} />
      </div>
      <div>
        <label className="block text-xs text-[#787c99] mb-1">完了ラベル</label>
        <input value={defaultLabelRead} onChange={(e) => setDefaultLabelRead(e.target.value)} placeholder="完了" className={`${inputClass} placeholder-[#4a5177]`} />
      </div>
    </div>
    <label className="block text-xs text-[#787c99] mb-2">マスのサイズ</label>
    <div className="grid grid-cols-3 gap-2">
      {([["1", "1行"], ["2", "2行"], ["full", "全文"]] as const).map(([val, label]) => (
        <button key={val} onClick={() => setItemSize(val)}
          className="py-2.5 rounded-xl border text-sm font-medium transition-colors active:scale-95"
          style={itemSize === val
            ? { backgroundColor: `${ACCENT_COLORS[color].hex}22`, borderColor: ACCENT_COLORS[color].hex, color: ACCENT_COLORS[color].hex }
            : { backgroundColor: "#24283b", borderColor: "#3b4261", color: "#787c99" }}
        >{label}</button>
      ))}
    </div>
  </div>
)}

          {error && <p className="text-xs text-[#f7768e]">{error}</p>}
        </div>
      </div>
    </div>
  );
}
