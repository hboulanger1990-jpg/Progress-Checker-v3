import { useState, useEffect, useRef } from "react";
import { BookOpen, Search, X, Plus, Pencil, Trash2, Sparkles, SunMoon, Loader2, Download, CloudUpload, ScanText } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { loadVocabFromCloud, saveVocabToCloud } from "../storage";

// ---- 型定義 ----
export interface VocabEntry {
  id: string;
  word: string;
  reading?: string;
  meaning: string;
  work?: string;
  example?: string;
  createdAt: number;
}

type ViewMode = "group" | "kana";
type Density = "word" | "meaning" | "all";
type SearchType = "word" | "work";

const STORAGE_KEY = "vocab-entries";

// ---- localStorage ----
function loadVocab(): VocabEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveVocab(entries: VocabEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ---- AI意味取得（Supabase Edge Function経由） ----
// TODO: 下の2つをあなたのSupabaseプロジェクトの値に置き換えてください
//   SUPABASE_URL: プロジェクトの設定 > API > Project URL
//   SUPABASE_ANON_KEY: プロジェクトの設定 > API > anon public キー
const SUPABASE_URL = "https://ckdsmlskfkwoodbuobhs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5E0KFXPHVgjbm59GoLs1-Q_EUPoQ72b";

async function fetchMeaningFromAI(word: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-meaning`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ word }),
  });
  const data = await res.json();
  if (!data.meaning) throw new Error(data.error || "no meaning returned");
  return data.meaning;
}

// ---- ソート ----
function kanaSort(a: VocabEntry, b: VocabEntry) {
  return (a.reading || a.word).localeCompare(b.reading || b.word, "ja");
}

// ---- 50音グルーピング用キー ----
// Googleレンズ等からの貼り付けで紛れ込みやすい不可視文字（ゼロ幅スペース等）や
// 全角/半角の差異を吸収してから先頭1文字を取る。これにより見た目が同じ語が
// 別グループに分裂してしまう（同じ語が増殖して見える）のを防ぐ。
function normalizeKanaKey(raw: string): string {
  const cleaned = raw
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "")
    .trim();
  return cleaned.charAt(0) || "#";
}

// ---- CSVエクスポート ----
function escapeCsvField(field: string): string {
  const needsQuote = /[",\n]/.test(field);
  const escaped = field.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function exportToCsv(entries: VocabEntry[]) {
  const headers = ["単語", "よみがな", "意味", "登場作品", "用例", "登録日"];
  const rows = entries.map(e => [
    e.word,
    e.reading ?? "",
    e.meaning,
    e.work ?? "",
    e.example ?? "",
    new Date(e.createdAt).toLocaleDateString("ja-JP"),
  ]);
  const csvLines = [headers, ...rows].map(row => row.map(f => escapeCsvField(String(f))).join(","));
  // Excelで開いたとき日本語が文字化けしないようUTF-8 BOM付きにする
  const csvContent = "\uFEFF" + csvLines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `語彙ノート_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Props ----
interface Props {
  user: User | null;
  theme: "dark" | "light" | "sepia";
  onToggleTheme: () => void;
  onSwitchToProgress: () => void;
}

// ---- フォームの初期値 ----
const EMPTY_FORM = { word: "", reading: "", meaning: "", work: "", example: "" };

export default function VocabScreen({ user, theme, onToggleTheme, onSwitchToProgress }: Props) {
  const [entries, setEntries] = useState<VocabEntry[]>(() => loadVocab());
  const [viewMode, setViewMode] = useState<ViewMode>("group");
  const [density, setDensity] = useState<Density>("word");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("word");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHint, setAiHint] = useState("");
  const [syncing, setSyncing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const initialCloudLoadDone = useRef(false);

  // 起動時：ログイン中はクラウド優先で読み込み（クラウドになければlocalStorageから移行）
  useEffect(() => {
    if (!user) { initialCloudLoadDone.current = true; return; }
    (async () => {
      setSyncing(true);
      const cloud = await loadVocabFromCloud(user.id);
      if (cloud) {
        setEntries(cloud);
      } else if (entries.length > 0) {
        // ローカルにデータがあってクラウドにまだなければ移行
        await saveVocabToCloud(user.id, entries);
      }
      initialCloudLoadDone.current = true;
      setSyncing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 変更のたびにlocalStorageへ保存し、ログイン中はクラウドにも保存
  useEffect(() => {
    saveVocab(entries);
    if (user && initialCloudLoadDone.current) {
      saveVocabToCloud(user.id, entries);
    }
  }, [entries, user]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  // ---- フィルタ ----
  function getFiltered() {
    if (!searchQuery) return entries;
    if (searchType === "word")
      return entries.filter(e => e.word.includes(searchQuery) || (e.reading && e.reading.includes(searchQuery)));
    return entries.filter(e => e.work && e.work.includes(searchQuery));
  }

  // ---- AI取得 ----
  async function handleAI() {
    if (!form.word.trim()) { setAiHint("先に単語を入力してください"); return; }
    setAiLoading(true);
    setAiHint("");
    try {
      const meaning = await fetchMeaningFromAI(form.word.trim());
      setForm(f => ({ ...f, meaning }));
      setAiHint("✓ 取得しました。編集できます。");
    } catch {
      setAiHint("取得できませんでした。手動で入力してください。");
    } finally {
      setAiLoading(false);
    }
  }

  // ---- Googleレンズ起動 ----
  // 別タブ（スマホでは別アプリ）でGoogleレンズを開く。読み取り結果はLens側で
  // コピーしてもらい、このアプリに戻って用例欄に貼り付けてもらう想定。
  function openGoogleLens() {
    window.open("https://lens.google.com/", "_blank", "noopener,noreferrer");
  }

  // ---- モーダル ----
  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setAiHint("");
    setModalOpen(true);
  }
  function openEdit(id: string) {
    const e = entries.find(e => e.id === id);
    if (!e) return;
    setEditId(id);
    setForm({ word: e.word, reading: e.reading ?? "", meaning: e.meaning, work: e.work ?? "", example: e.example ?? "" });
    setAiHint("");
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditId(null); setForm(EMPTY_FORM); setAiHint(""); }

  function saveEntry() {
    if (!form.word.trim()) return;
    if (editId) {
      setEntries(prev => prev.map(e => e.id !== editId ? e : {
        ...e, word: form.word.trim(), reading: form.reading.trim(),
        meaning: form.meaning.trim(), work: form.work.trim(), example: form.example.trim(),
      }));
    } else {
      const entry: VocabEntry = {
        id: crypto.randomUUID(), createdAt: Date.now(),
        word: form.word.trim(), reading: form.reading.trim(),
        meaning: form.meaning.trim(), work: form.work.trim() || "作品不明",
        example: form.example.trim(),
      };
      setEntries(prev => [entry, ...prev]);
    }
    closeModal();
    setExpanded(null);
  }

  function deleteEntry(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id));
    if (expanded === id) setExpanded(null);
    setConfirmId(null);
  }

  // ---- グループ生成 ----
  const filtered = getFiltered();

  function renderGroups() {
    if (viewMode === "group") {
      const groups: Record<string, VocabEntry[]> = {};
      filtered.forEach(e => {
        const k = e.work || "作品不明";
        if (!groups[k]) groups[k] = [];
        groups[k].push(e);
      });
      return Object.entries(groups).map(([work, es]) => (
        <div key={work}>
          <div style={styles.groupLabel}>
            {work}<span style={styles.countBadge}>{es.length}語</span>
          </div>
          {es.map(e => <EntryCard key={e.id} entry={e} density={density} viewMode={viewMode}
            expanded={expanded === e.id} onToggle={() => setExpanded(expanded === e.id ? null : e.id)}
            onEdit={() => openEdit(e.id)} onDelete={() => setConfirmId(e.id)} />)}
        </div>
      ));
    } else {
      const sorted = [...filtered].sort(kanaSort);
      // 直前セクションとの隣接だけで束ねると、ソート結果がわずかにブレた場合
      // （不可視文字や正規化の違いなど）に同じ語が複数セクションに分裂して
      // 「増殖したように見える」原因になるため、キーごとにMapで束ねる。
      const groupMap = new Map<string, VocabEntry[]>();
      sorted.forEach(e => {
        const k = normalizeKanaKey(e.reading || e.word);
        if (!groupMap.has(k)) groupMap.set(k, []);
        groupMap.get(k)!.push(e);
      });
      const sections = Array.from(groupMap.entries()).map(([kana, es]) => ({ kana, entries: es }));
      return sections.map(({ kana, entries: es }) => (
        <div key={kana}>
          <div style={styles.groupLabel}>{kana}</div>
          {es.map(e => <EntryCard key={e.id} entry={e} density={density} viewMode={viewMode}
            expanded={expanded === e.id} onToggle={() => setExpanded(expanded === e.id ? null : e.id)}
            onEdit={() => openEdit(e.id)} onDelete={() => setConfirmId(e.id)} />)}
        </div>
      ));
    }
  }

  const confirmEntry = confirmId ? entries.find(e => e.id === confirmId) : null;

  return (
    <div style={styles.screen}>
      {/* ヘッダー */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>
          語彙ノート
          {syncing && <CloudUpload size={14} style={{ marginLeft: 8, opacity: 0.5, verticalAlign: "middle" }} />}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={styles.iconBtn} onClick={() => exportToCsv(entries)} aria-label="CSVエクスポート">
            <Download size={16} />
          </button>
          <button style={styles.iconBtn} onClick={onToggleTheme} aria-label="テーマ切替">
            <SunMoon size={16} />
          </button>
          <button style={styles.iconBtn} onClick={onSwitchToProgress} aria-label="Progress Checkerへ">
            <BookOpen size={16} />
          </button>
          <button
            style={{ ...styles.iconBtn, ...(searchOpen ? styles.iconBtnActive : {}) }}
            onClick={() => { setSearchOpen(v => !v); if (searchOpen) { setSearchQuery(""); } }}
            aria-label="検索"
          >
            <Search size={16} />
          </button>
        </div>
      </div>

      {/* ツールバー */}
      <div style={styles.toolbar}>
        <div style={styles.seg}>
          {(["group", "kana"] as const).map((v, i) => (
            <button key={v} style={{ ...styles.segBtn, ...(viewMode === v ? styles.segBtnActive : {}), ...(i > 0 ? { borderLeft: "0.5px solid var(--border)" } : {}) }}
              onClick={() => { setViewMode(v); setExpanded(null); }}>
              {v === "group" ? "作品別" : "50音順"}
            </button>
          ))}
        </div>
        <div style={{ width: "0.5px", height: 20, background: "var(--border)", margin: "0 2px" }} />
        <div style={styles.seg}>
          {(["word", "meaning", "all"] as const).map((v, i) => (
            <button key={v} style={{ ...styles.segBtn, ...(density === v ? styles.segBtnActive : {}), ...(i > 0 ? { borderLeft: "0.5px solid var(--border)" } : {}) }}
              onClick={() => { setDensity(v); setExpanded(null); }}>
              {v === "word" ? "単語" : v === "meaning" ? "＋意味" : "すべて"}
            </button>
          ))}
        </div>
      </div>

      {/* 検索バー */}
      {searchOpen && (
        <div style={styles.searchBar}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input ref={searchRef} style={styles.searchInput} value={searchQuery} placeholder="検索…"
              onChange={e => { setSearchQuery(e.target.value); setExpanded(null); }} />
            <button style={styles.iconBtn} onClick={() => { setSearchOpen(false); setSearchQuery(""); }} aria-label="閉じる"><X size={16} /></button>
          </div>
          <div style={{ display: "flex", gap: 0, marginTop: 6, border: "0.5px solid var(--border)", borderRadius: 6, overflow: "hidden", width: "fit-content" }}>
            {(["word", "work"] as const).map((v, i) => (
              <button key={v} style={{ ...styles.segBtn, ...(searchType === v ? styles.segBtnActive : {}), ...(i > 0 ? { borderLeft: "0.5px solid var(--border)" } : {}) }}
                onClick={() => { setSearchType(v); setExpanded(null); }}>
                {v === "word" ? "単語" : "作品"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* リスト */}
      <div style={styles.content}>
        {filtered.length === 0
          ? <div style={styles.empty}>該当する単語が見つかりません</div>
          : renderGroups()
        }
      </div>

      {/* FAB */}
      <button style={styles.fab} onClick={openAdd} aria-label="単語を追加"><Plus size={22} /></button>

      {/* 追加・編集モーダル */}
      {modalOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <p style={styles.modalTitle}>{editId ? "単語を編集" : "単語を追加"}</p>

            <FormGroup label="単語">
              <input style={styles.input} value={form.word} placeholder="例：逡巡"
                onChange={e => setForm(f => ({ ...f, word: e.target.value }))} />
            </FormGroup>

            <FormGroup label="よみがな（任意）">
              <input style={styles.input} value={form.reading} placeholder="例：しゅんじゅん"
                onChange={e => setForm(f => ({ ...f, reading: e.target.value }))} />
            </FormGroup>

            <FormGroup label="意味">
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <textarea style={{ ...styles.input, ...styles.textarea, flex: 1 }} value={form.meaning}
                  placeholder="ここに意味を入力、またはAIで取得"
                  onChange={e => setForm(f => ({ ...f, meaning: e.target.value }))} />
                <button style={styles.aiBtn} onClick={handleAI} disabled={aiLoading} aria-label="AIで意味を取得">
                  {aiLoading ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Sparkles size={13} />}
                  <span>{aiLoading ? "取得中" : "AI取得"}</span>
                </button>
              </div>
              {aiHint && <div style={styles.aiHint}>{aiHint}</div>}
            </FormGroup>

            <FormGroup label="登場作品">
              <input style={styles.input} value={form.work} placeholder="例：砂の女"
                onChange={e => setForm(f => ({ ...f, work: e.target.value }))} />
            </FormGroup>

            <FormGroup label="用例文">
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <textarea style={{ ...styles.input, ...styles.textarea, flex: 1 }} value={form.example}
                  placeholder="作品中の文章をここに"
                  onChange={e => setForm(f => ({ ...f, example: e.target.value }))} />
                <button style={styles.aiBtn} onClick={openGoogleLens} aria-label="Googleレンズを開く">
                  <ScanText size={13} />
                  <span>Lens</span>
                </button>
              </div>
              <div style={styles.aiHint}>Lensで読み取った文字をコピーして、ここに貼り付け</div>
            </FormGroup>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button style={styles.btnCancel} onClick={closeModal}>キャンセル</button>
              <button style={styles.btnSave} onClick={saveEntry}>{editId ? "保存する" : "追加する"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認 */}
      {confirmId && confirmEntry && (
        <div style={{ ...styles.overlay, alignItems: "center", justifyContent: "center" }}>
          <div style={styles.confirmBox}>
            <p style={{ fontSize: 15, color: "var(--text-primary)", marginBottom: 4 }}>この単語を削除しますか？</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{confirmEntry.word}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button style={styles.btnCancel} onClick={() => setConfirmId(null)}>キャンセル</button>
              <button style={styles.btnDel} onClick={() => deleteEntry(confirmId)}>削除</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ---- EntryCard ----
interface CardProps {
  entry: VocabEntry;
  density: Density;
  viewMode: ViewMode;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function EntryCard({ entry: e, density, viewMode, expanded, onToggle, onEdit, onDelete }: CardProps) {
  const showReadingInline = (density === "word" || density === "all") && e.reading;
  const showMeaningAlways = (density === "meaning" || density === "all") && e.meaning;

  const expandShowReading = density === "meaning" && e.reading;
  const expandShowMeaning = density === "word" && e.meaning;
  const expandShowExample = !!e.example;
  const expandShowWork = viewMode === "kana" && !!e.work;
  const hasDetail = expandShowReading || expandShowMeaning || expandShowExample || expandShowWork;

  return (
    <div
      style={{ ...styles.card, ...(expanded ? styles.cardExpanded : {}) }}
      onClick={e2 => { if ((e2.target as HTMLElement).closest("[data-action]")) return; if (hasDetail) onToggle(); }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={styles.word}>{e.word}</span>
            {showReadingInline && <span style={styles.reading}>{e.reading}</span>}
          </div>
          {showMeaningAlways && <div style={styles.previewMeaning}>{e.meaning}</div>}
        </div>
        {expanded && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button data-action="edit" style={styles.actBtn} onClick={e2 => { e2.stopPropagation(); onEdit(); }} aria-label="編集">
              <Pencil size={14} />
            </button>
            <button data-action="del" style={{ ...styles.actBtn, ...styles.actBtnDel }} onClick={e2 => { e2.stopPropagation(); onDelete(); }} aria-label="削除">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {expanded && hasDetail && (
        <div style={styles.detail}>
          {expandShowReading && (
            <div><div style={styles.detailLabel}>よみがな</div><div style={styles.detailText}>{e.reading}</div></div>
          )}
          {expandShowMeaning && (
            <div><div style={styles.detailLabel}>意味</div><div style={styles.detailText}>{e.meaning}</div></div>
          )}
          {expandShowExample && (
            <div><div style={styles.detailLabel}>用例</div><div style={styles.exampleBox}>{e.example}</div></div>
          )}
          {expandShowWork && (
            <div><span style={styles.workTag}>{e.work}</span></div>
          )}
        </div>
      )}
    </div>
  );
}

function FormGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  );
}

// ---- スタイル ----
const styles: Record<string, React.CSSProperties> = {
  screen: { background: "var(--bg-base)", minHeight: "100dvh", position: "relative", paddingBottom: 80 },
  header: { background: "var(--bg-surface)", borderBottom: "0.5px solid var(--border)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 17, fontWeight: 500, color: "var(--text-primary)" },
  iconBtn: { background: "var(--bg-surface)", border: "0.5px solid var(--border)", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)" },
  iconBtnActive: { background: "#7aa2f722", borderColor: "#7aa2f7", color: "#7aa2f7" },
  toolbar: { background: "var(--bg-surface)", borderBottom: "0.5px solid var(--border)", padding: "8px 16px", display: "flex", gap: 6, alignItems: "center" },
  seg: { display: "flex", border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden" },
  segBtn: { padding: "5px 10px", fontSize: 12, background: "var(--bg-surface)", color: "var(--text-muted)", border: "none", cursor: "pointer", whiteSpace: "nowrap" },
  segBtnActive: { background: "#7aa2f7", color: "#1a1b26", fontWeight: 500 },
  searchBar: { padding: "8px 16px", background: "var(--bg-surface)", borderBottom: "0.5px solid var(--border)" },
  searchInput: { flex: 1, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, width: "100%" },
  content: { padding: "12px 16px" },
  groupLabel: { fontSize: 12, fontWeight: 500, color: "var(--text-muted)", padding: "14px 0 6px", letterSpacing: "0.03em" },
  countBadge: { fontSize: 12, color: "var(--text-dim)", fontWeight: 400, marginLeft: 5 },
  card: { background: "var(--bg-surface)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "11px 14px", marginBottom: 7, cursor: "pointer", transition: "border-color 0.12s" },
  cardExpanded: { borderColor: "var(--text-dim)" },
  word: { fontSize: 16, fontWeight: 500, color: "var(--text-primary)" },
  reading: { fontSize: 13, color: "var(--text-muted)" },
  previewMeaning: { fontSize: 13, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  detail: { marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 },
  detailLabel: { fontSize: 11, fontWeight: 500, color: "var(--text-dim)", letterSpacing: "0.04em", marginBottom: 2 },
  detailText: { fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 },
  exampleBox: { fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, background: "var(--bg-overlay)", borderRadius: 8, padding: "8px 10px", borderLeft: "2.5px solid var(--border-dim)" },
  workTag: { display: "inline-block", fontSize: 11, background: "var(--bg-overlay)", color: "var(--text-muted)", border: "0.5px solid var(--border)", borderRadius: 100, padding: "2px 8px" },
  actBtn: { width: 30, height: 30, borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--bg-overlay)", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  actBtnDel: {},
  empty: { textAlign: "center", padding: "40px 0", color: "var(--text-dim)", fontSize: 14 },
  fab: { position: "fixed", bottom: 24, right: 20, width: 48, height: 48, borderRadius: "50%", background: "#7aa2f7", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#1a1b26" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", zIndex: 50 },
  modal: { background: "var(--bg-surface)", borderRadius: "16px 16px 0 0", padding: "20px 16px 32px", width: "100%", maxWidth: 600, margin: "0 auto" },
  modalTitle: { fontSize: 16, fontWeight: 500, color: "var(--text-primary)", marginBottom: 14 },
  input: { width: "100%", padding: "8px 10px", border: "0.5px solid var(--border)", borderRadius: 8, background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, fontFamily: "inherit" },
  textarea: { resize: "vertical", minHeight: 64, lineHeight: 1.6 },
  aiBtn: { flexShrink: 0, padding: "0 10px", height: 38, border: "0.5px solid #7aa2f7", borderRadius: 8, background: "#7aa2f722", color: "#7aa2f7", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" },
  aiHint: { fontSize: 11, color: "var(--text-dim)", marginTop: 3 },
  btnCancel: { flex: 1, padding: 10, border: "0.5px solid var(--border)", borderRadius: 8, background: "var(--bg-overlay)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" },
  btnSave: { flex: 2, padding: 10, border: "none", borderRadius: 8, background: "#7aa2f7", color: "#1a1b26", fontSize: 14, fontWeight: 500, cursor: "pointer" },
  confirmBox: { background: "var(--bg-surface)", borderRadius: 12, padding: 20, width: 260, textAlign: "center" },
  btnDel: { flex: 1, padding: 10, border: "none", borderRadius: 8, background: "#f7768e", color: "#1a1b26", fontSize: 14, fontWeight: 500, cursor: "pointer" },
};
