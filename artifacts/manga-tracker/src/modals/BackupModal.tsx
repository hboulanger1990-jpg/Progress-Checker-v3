import { CloudUpload, Check } from "lucide-react";
import { useState } from "react";
import type { Folder } from "../types";
import { exportData, importData } from "../storage";

interface Props {
  data: Folder[];
  onClose: () => void;
  onImport: (data: Folder[]) => void;
}

export default function BackupModal({ data, onClose, onImport }: Props) {
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [tab, setTab] = useState<"export" | "import">("export");

  const json = exportData(data);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      const el = document.createElement("textarea");
      el.value = json;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleImport() {
    const parsed = importData(importText.trim());
    if (!parsed) { setImportError("JSONの形式が正しくありません"); return; }
    if (!window.confirm(`${parsed.length}件のフォルダをインポートします。現在のデータは上書きされます。よろしいですか？`)) return;
    onImport(parsed);
    onClose();
  }

  const tabClass = (t: "export" | "import") =>
    `flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? "bg-[#3b4261] text-[#c0caf5]" : "text-[#787c99]"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#1f2335] border border-[#3b4261] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl animate-slide-up max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#c0caf5]">バックアップ</h2>
          <button onClick={onClose} className="text-[#787c99] hover:text-[#c0caf5] text-xl leading-none transition-colors"><CloudUpload size={20} /></button>
        </div>
        <div className="flex gap-1 mb-4 bg-[#24283b] rounded-xl p-1">
          <button onClick={() => setTab("export")} className={tabClass("export")}>エクスポート</button>
          <button onClick={() => setTab("import")} className={tabClass("import")}>インポート</button>
        </div>

        {tab === "export" && (
          <div className="flex flex-col gap-3 flex-1 overflow-hidden">
            <p className="text-xs text-[#787c99]">全データをJSONとしてコピーし、メモ帳などに保管してください。</p>
            <textarea readOnly value={json} className="flex-1 min-h-[160px] bg-[#24283b] text-[#787c99] text-xs border border-[#3b4261] rounded-xl p-3 outline-none font-mono resize-none" />
            <button
              onClick={handleCopy}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-1 ${copied ? "bg-[#9ece6a] text-[#1a1b26]" : "bg-[#7aa2f7] text-[#1a1b26]"}`}
            >
              {copied ? <><Check size={20} /> コピーしました！</> : "JSONをコピー"}
            </button>
          </div>
        )}

        {tab === "import" && (
          <div className="flex flex-col gap-3 flex-1 overflow-hidden">
            <p className="text-xs text-[#787c99]">バックアップしたJSONファイルを選択するか、テキストを貼り付けてインポートします。</p>
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  setImportText(ev.target?.result as string);
                  setImportError("");
                };
                reader.readAsText(file);
              }}
              className="text-xs text-[#787c99] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#3b4261] file:text-[#c0caf5] file:text-xs"
            />
            <textarea
              value={importText}
              onChange={(e) => { setImportText(e.target.value); setImportError(""); }}
              placeholder="またはJSONを貼り付け..."
              className="flex-1 min-h-[120px] bg-[#24283b] text-[#c0caf5] text-xs border border-[#3b4261] rounded-xl p-3 outline-none font-mono resize-none placeholder-[#4a5177] focus:border-[#7aa2f7] transition-colors"
            />
            {importError && <p className="text-xs text-[#f7768e]">{importError}</p>}
            <button
              onClick={handleImport}
              disabled={!importText.trim()}
              className="w-full py-3 rounded-xl bg-[#f7768e] text-white text-sm font-bold active:scale-95 transition-all disabled:opacity-40"
            >
              インポートする
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
