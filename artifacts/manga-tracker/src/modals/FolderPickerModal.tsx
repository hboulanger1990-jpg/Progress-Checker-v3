import { ArrowRight } from "lucide-react";
import type { Folder } from "../types";
import { ACCENT_COLORS } from "../types";

interface Props {
  folders: Folder[];
  title: string;
  description?: string;
  onClose: () => void;
  onSelect: (folderId: string) => void;
}

export default function FolderPickerModal({ folders, title, description, onClose, onSelect }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-[--shadow-modal]/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-sm bg-[var(--bg-overlay)] border border-[var(--border)] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl overflow-y-auto"
        style={{ maxHeight: "90dvh" }}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl border border-[var(--border)] text-[var(--text-muted)] text-sm font-medium active:scale-95 transition-transform"
          >
            戻る
          </button>
        </div>
        {description && <p className="text-xs text-[var(--text-dim)] mb-4">{description}</p>}

        {folders.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-8 text-center">統合できるフォルダがありません</p>
        ) : (
          <div className="space-y-2 mt-2">
            {folders.map((f) => {
              const hex = ACCENT_COLORS[f.accentColor].hex;
              return (
                <button
                  key={f.id}
                  onClick={() => onSelect(f.id)}
                  className="w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left active:scale-[0.99] transition-transform"
                  style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                  <span className="flex-1 min-w-0 truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {f.title}
                  </span>
                  <ArrowRight size={16} style={{ color: "var(--text-dim)" }} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
