import { FileDigit, FileType2, Pencil, Plus } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import type { Section } from "../types";

interface Props {
  mode: "add" | "edit";
  initial?: Section;
  defaults?: { label: string; startNum: number; endNum?: number };
  labelName?: string;
  workId: string;
  onClose: () => void;
  onSave: (label: string, startNum: number, endNum: number, sectionMode: "number" | "text", items: string[]) => void;
}

const SECTION_MODE_KEY = "pc-section-mode-";

export default function SectionModal({ mode, initial, defaults, labelName = "セクション", workId, onClose, onSave }: Props) {
  const debugClose = () => {
  console.trace("onClose called");
  onClose();
};
  const [label, setLabel] = useState(initial?.label ?? defaults?.label ?? "");
  const [startNum, setStartNum] = useState(String(initial?.startNum ?? defaults?.startNum ?? 1));
  const [endNum, setEndNum] = useState(
    initial?.endNum != null ? String(initial.endNum) :
    defaults?.endNum != null ? String(defaults.endNum) : ""
  );
  const savedMode = localStorage.getItem(SECTION_MODE_KEY + workId) as "number" | "text" | null;
  const [sectionMode, setSectionMode] = useState<"number" | "text">(
    initial?.mode ?? savedMode ?? "number"
  );
  const [items, setItems] = useState<string[]>(initial?.items ?? [""]);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  function handleSetMode(m: "number" | "text") {
    setSectionMode(m);
    localStorage.setItem(SECTION_MODE_KEY + workId, m);
  }

  function insertItem(index: number) {
    const next = [...items];
    next.splice(index, 0, "");
    setItems(next);
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>(".text-item-input");
      inputs[index]?.focus();
    }, 30);
  }

  function handleItemChange(index: number, value: string) {
    const next = [...items];
    next[index] = value;
    setItems(next);
    setError("");
  }

  function handleItemKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      insertItem(index + 1);
    }
  }

  function handleItemPaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text");
    const lines = pasted.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
    if (lines.length <= 1) return;
    e.preventDefault();
    const before = items.slice(0, index);
    const after = items.slice(index + 1).filter((l) => l.trim() !== "");
    const next = [...before, ...lines, ...after];
    if (next[next.length - 1] !== "") next.push("");
    setItems(next);
    setError("");
  }

  function removeItem(index: number) {
    if (items.filter((i) => i.trim() !== "").length <= 1 && items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function handleSave() {
    const l = label.trim();
    if (!l) { setError(`${labelName}名を入力してください`); return; }

    if (sectionMode === "text") {
      const validItems = items.filter((i) => i.trim() !== "");
      if (validItems.length === 0) { setError("項目を1つ以上入力してください"); return; }
      onSave(l, 1, validItems.length, "text", validItems);
      return;
    }

    const s = parseInt(startNum, 10);
    if (isNaN(s) || s < 1) { setError("開始番号が正しくありません"); return; }
    if (!endNum.trim()) { setError("終了番号を入力してください"); return; }
    const e = parseInt(endNum, 10);
    if (isNaN(e) || e < s) { setError("終了番号は開始番号以上にしてください"); return; }
    if (e - s + 1 > 2000) { setError("最大2000項目まで設定できます"); return; }
    onSave(l, s, e, "number", []);
  }

  const inputClass = "w-full bg-[#24283b] text-[#c0caf5] border border-[#3b4261] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#7aa2f7] transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={undefined}
      />
      <div
        className="relative w-full sm:max-w-sm bg-[#1f2335] border border-[#3b4261] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl overflow-y-auto"
        style={{ maxHeight: "90dvh" }}
      >
        <h2 className="text-lg font-bold text-[#c0caf5] mb-5">
          {mode === "add" ? `${labelName}を追加` : `${labelName}を編集`}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#787c99] mb-1">{labelName}名</label>
            <input
              ref={inputRef}
              value={label}
              onChange={(e) => { setLabel(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs text-[#787c99] mb-2">入力モード</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSetMode("number")}
                className="py-2 rounded-xl border text-sm font-medium transition-colors active:scale-95"
                style={
                  sectionMode === "number"
                    ? { backgroundColor: "#7aa2f733", borderColor: "#7aa2f7", color: "#7aa2f7" }
                    : { backgroundColor: "#24283b", borderColor: "#3b4261", color: "#787c99" }
                }
              >
                <FileDigit size={20}  className="inline" /> 数字
              </button>
              <button
                onClick={() => handleSetMode("text")}
                className="py-2 rounded-xl border text-sm font-medium transition-colors active:scale-95"
                style={
                  sectionMode === "text"
                    ? { backgroundColor: "#7aa2f733", borderColor: "#7aa2f7", color: "#7aa2f7" }
                    : { backgroundColor: "#24283b", borderColor: "#3b4261", color: "#787c99" }
                }
              >
                <FileType2 size={20}  className="inline"/> テキスト
              </button>
            </div>
          </div>

          {sectionMode === "number" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#787c99] mb-1">開始番号</label>
                <input
                  type="number"
                  value={startNum}
                  onChange={(e) => { setStartNum(e.target.value); setError(""); }}
                  min={1}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-[#787c99] mb-1">終了番号</label>
                <input
                  type="number"
                  value={endNum}
                  onChange={(e) => { setEndNum(e.target.value); setError(""); }}
                  min={1}
                  className={inputClass}
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-[#787c99] mb-2">
                項目（Enterで下に追加・複数行コピペ可）
              </label>

              {/* 一番上に追加ボタン */}
              <button
                onClick={() => insertItem(0)}
                className="w-full mb-1.5 py-1 rounded-lg border border-dashed border-[#3b4261] text-[#4a5177] text-xs active:scale-95 transition-transform hover:border-[#7aa2f7] hover:text-[#7aa2f7]"
              >
                <Plus size={20} />先頭に追加
              </button>

              <div className="space-y-1.5">
                {items.map((item, index) => (
                  <div key={index}>
                    <div className="flex gap-2 items-center">
                      <input
                        value={item}
                        onChange={(e) => handleItemChange(index, e.target.value)}
                        onKeyDown={(e) => handleItemKeyDown(index, e)}
                        onPaste={(e) => handleItemPaste(index, e)}
                        placeholder={`項目 ${index + 1}`}
                        className={`text-item-input ${inputClass} placeholder-[#4a5177]`}
                      />
                      <button
                        onClick={() => removeItem(index)}
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1b26] text-[#f7768e] border border-[#3b4261] active:scale-95"
                      >×</button>
                    </div>
                    {/* 各項目の下に追加ボタン */}
                    <button
                      onClick={() => insertItem(index + 1)}
                      className="w-full mt-1 py-0.5 rounded border border-dashed border-[#2a2d3e] text-[#4a5177] text-xs active:scale-95 transition-transform hover:border-[#7aa2f7] hover:text-[#7aa2f7]"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[#4a5177] mt-2">※テキスト入力中は外側クリックで閉じません</p>
            </div>
          )}

          {error && <p className="text-xs text-[#f7768e]">{error}</p>}
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#3b4261] text-[#787c99] text-sm font-medium active:scale-95 transition-transform">
            キャンセル
          </button>
          <button onClick={handleSave} className="flex-1 py-3 rounded-xl bg-[#7aa2f7] text-[#1a1b26] text-sm font-bold active:scale-95 transition-transform">
            {mode === "add" ? "追加" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
