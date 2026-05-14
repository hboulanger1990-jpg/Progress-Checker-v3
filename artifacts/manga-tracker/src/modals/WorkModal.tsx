import { useState, useEffect, useRef } from "react";
import type { AccentColor, Work } from "../types";
import { ACCENT_COLORS } from "../types";

interface Props {
  mode: "add" | "edit";
  initial?: Work;
  folderDefaults?: { labelUnread: string; labelRead: string; unit: string };
  folderAccentColor?: AccentColor;
  existingTags?: string[];
  onClose: () => void;
  onSave: (data: {
    title: string;
    accentColor: AccentColor;
    labelUnread: string;
    labelRead: string;
    unit: string;
    sectionLabel: string;
    tags: string[];
  }) => void;
}

const COLOR_KEYS = Object.keys(ACCENT_COLORS) as AccentColor[];

export default function WorkModal({ mode, initial, folderDefaults, folderAccentColor, existingTags = [], onClose, onSave }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [color, setColor] = useState<AccentColor>(initial?.accentColor ?? folderAccentColor ?? "blue");
  const [labelUnread, setLabelUnread] = useState(initial?.labelUnread ?? folderDefaults?.labelUnread ?? "未完了");
  const [labelRead, setLabelRead] = useState(initial?.labelRead ?? folderDefaults?.labelRead ?? "完了");
  const [unit, setUnit] = useState(initial?.unit ?? folderDefaults?.unit ?? "");
  const [sectionLabel, setSectionLabel] = useState(initial?.sectionLabel ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [error, setError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  useEffect(() => {
    const handler = (e: Event) => { e.stopImmediatePropagation(); };
    document.addEventListener("visibilitychange", handler, true);
    return () => document.removeEventListener("visibilitychange", handler, true);
  }, []);

  const tagSuggestions = existingTags.filter(
    (t) => !tags.includes(t) && (tagInput.trim() === "" || t.toLowerCase().includes(tagInput.toLowerCase()))
  );

  function addTag(tag?: string) {
    const t = (tag ?? tagInput).trim();
    if (!t || tags.includes(t)) { setTagInput(""); setShowSuggestions(false); return; }
    setTags([...tags, t]);
    setTagInput("");
    setShowSuggestions(false);
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleSave() {
    const t = title.trim();
    if (!t) { setError("タイトルを入力してください"); return; }
    if (!labelUnread.trim() || !labelRead.trim()) { setError("ステータス名を入力してください"); return; }
    onSave({
      title: t,
      accentColor: color,
      labelUnread: labelUnread.trim(),
      labelRead: labelRead.trim(),
      unit: unit.trim(),
      sectionLabel: sectionLabel.trim(),
      tags,
    });
  }

  const inputClass = "w-full bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#7aa2f7] transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-[--shadow-modal]/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-sm bg-[var(--bg-overlay)] border border-[var(--border)] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl overflow-y-auto"
        style={{ maxHeight: "90dvh" }}
      >
        {/* タイトル行 + ボタン */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {mode === "add" ? "作品を追加" : "作品を編集"}
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
              className="px-3 py-1.5 rounded-xl bg-[#7aa2f7] text-[var(--bg-base)] text-sm font-bold active:scale-95 transition-transform"
            >
              {mode === "add" ? "追加" : "保存"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">タイトル</label>
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-2">アクセントカラー</label>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">未完了ラベル</label>
              <input value={labelUnread} onChange={(e) => setLabelUnread(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">完了ラベル</label>
              <input value={labelRead} onChange={(e) => setLabelRead(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">単位</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="話・巻など" className={`${inputClass} placeholder-[var(--text-dim)]`} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">セクション名</label>
              <input
                value={sectionLabel}
                onChange={(e) => setSectionLabel(e.target.value)}
                placeholder="セクション"
                className={`${inputClass} placeholder-[var(--text-dim)]`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">タグ（省略可）</label>
            <div className="relative">
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => { setTagInput(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addTag(); }
                    if (e.key === "Escape") setShowSuggestions(false);
                  }}
                  placeholder="タグを入力またはタップで選択"
                  className={`${inputClass} placeholder-[var(--text-dim)] flex-1`}
                />
                <button
                  onClick={() => addTag()}
                  className="shrink-0 px-3 py-2 rounded-xl bg-[var(--border-dim)] border border-[var(--border)] text-[var(--text-muted)] text-sm active:scale-95 transition-transform"
                >追加</button>
              </div>
              {showSuggestions && tagSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-[var(--bg-overlay)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                  {tagSuggestions.map((tag) => (
                    <button
                      key={tag}
                      onMouseDown={(e) => { e.preventDefault(); addTag(tag); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-[var(--text-sub)] hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-2"
                    >
                      <span className="text-[var(--text-muted)]">#</span>{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--border-dim)] border border-[var(--border)] text-xs text-[var(--text-sub)]"
                  >
                    #{tag}
                    <button onClick={() => removeTag(tag)} className="text-[#f7768e] leading-none">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-[#f7768e]">{error}</p>}
        </div>
      </div>
    </div>
  );
}
