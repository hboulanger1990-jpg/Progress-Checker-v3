import { useState, useEffect, useRef } from "react";

interface Props {
  mode: "add" | "edit";
  initial?: string;
  existingGenres?: string[];
  onClose: () => void;
  onSave: (name: string) => void;
}

export default function GenreModal({ mode, initial, existingGenres = [], onClose, onSave }: Props) {
  const [name, setName] = useState(initial ?? "");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  useEffect(() => {
    const handler = (e: Event) => { e.stopImmediatePropagation(); };
    document.addEventListener("visibilitychange", handler, true);
    return () => document.removeEventListener("visibilitychange", handler, true);
  }, []);

  function handleSave() {
    const n = name.trim();
    if (!n) { setError("ジャンル名を入力してください"); return; }
    const isDuplicate = existingGenres.some((g) => g === n && g !== initial);
    if (isDuplicate) { setError("同じ名前のジャンルがすでにあります"); return; }
    onSave(n);
  }

  const inputClass = "w-full bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--accent-primary)] transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-[--shadow-modal]/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-sm bg-[var(--bg-overlay)] border border-[var(--border)] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {mode === "add" ? "ジャンルを追加" : "ジャンルを編集"}
          </h2>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-[var(--border)] text-[var(--text-muted)] text-sm font-medium active:scale-95 transition-transform"
            >
              戻る
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded-xl bg-[var(--accent-primary)] text-[var(--bg-base)] text-sm font-bold active:scale-95 transition-transform"
            >
              {mode === "add" ? "追加" : "保存"}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">ジャンル名</label>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
            className={inputClass}
          />
        </div>

        {error && <p className="text-xs text-[#f7768e] mt-2">{error}</p>}
      </div>
    </div>
  );
}
