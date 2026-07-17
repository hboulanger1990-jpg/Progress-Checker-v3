// VERSION-MARK: border-longhand-fix-01
import { useState, useEffect, useRef } from "react";
import { BookOpen, Search, X, Plus, Pencil, Trash2, Sparkles, SunMoon, Loader2, Download, CloudUpload, ScanText, Star, ChevronDown, Menu, Package } from "lucide-react";
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
  favLevel?: 1 | 2 | 3; // ★の段階（お気に入りではなく頻出度等の区別用）。未設定 or 0 = ★なし
  createdAt: number;
}

// 旧favorite(boolean)からfavLevel(0-3)への移行。favorite:trueだったものはlevel1として扱う。
function migrateEntry(raw: any): VocabEntry {
  if (raw.favLevel !== undefined) return raw as VocabEntry;
  const { favorite, ...rest } = raw;
  return { ...rest, favLevel: favorite ? 1 : undefined };
}
function migrateEntries(raw: any[]): VocabEntry[] {
  return raw.map(migrateEntry);
}

type ViewMode = "group" | "kana";
type Density = "word" | "meaning" | "all";
type SearchType = "word" | "work";

type FavFilter = "none" | "ge1" | "eq1" | "eq2" | "eq3";
const FAV_FILTER_ORDER: FavFilter[] = ["none", "eq1", "eq2", "eq3", "ge1"];
function nextFavFilter(f: FavFilter): FavFilter {
  return FAV_FILTER_ORDER[(FAV_FILTER_ORDER.indexOf(f) + 1) % FAV_FILTER_ORDER.length];
}
function matchesFavFilter(level: number, f: FavFilter): boolean {
  switch (f) {
    case "none": return true;
    case "ge1": return level >= 1;
    case "eq1": return level === 1;
    case "eq2": return level === 2;
    case "eq3": return level === 3;
  }
}
function favFilterLabel(f: FavFilter): string {
  switch (f) {
    case "ge1": return "1+";
    case "eq1": return "1";
    case "eq2": return "2";
    case "eq3": return "3";
    default: return "";
  }
}

const STORAGE_KEY = "vocab-entries";

// ---- localStorage ----
function loadVocab(): VocabEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrateEntries(JSON.parse(raw)) : [];
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

async function fetchMeaningFromAI(word: string, reading?: string): Promise<{ meaning: string; reading: string }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-meaning`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ word, reading: reading || undefined }),
  });
  const data = await res.json();
  if (data.error === "rate_limited") {
    const err = new Error(data.message || "rate limited");
    (err as Error & { rateLimited?: boolean }).rateLimited = true;
    throw err;
  }
  if (!data.meaning) throw new Error(data.error || "no meaning returned");
  return { meaning: data.meaning, reading: data.reading || "" };
}

// ---- ソート ----
function kanaSort(a: VocabEntry, b: VocabEntry) {
  return (a.reading || a.word).localeCompare(b.reading || b.word, "ja");
}

// 濁音・半濁音を清音の見出しにまとめるためのマップ（例：「が」は「か」の項目に含める）
// 「は」行のみ濁音（ば行）・半濁音（ぱ行）の両方が「は」にまとまる
const DAKUTEN_MAP: Record<string, string> = {
  "が": "か", "ぎ": "き", "ぐ": "く", "げ": "け", "ご": "こ",
  "ざ": "さ", "じ": "し", "ず": "す", "ぜ": "せ", "ぞ": "そ",
  "だ": "た", "ぢ": "ち", "づ": "つ", "で": "て", "ど": "と",
  "ば": "は", "び": "ひ", "ぶ": "ふ", "べ": "へ", "ぼ": "ほ",
  "ぱ": "は", "ぴ": "ひ", "ぷ": "ふ", "ぺ": "へ", "ぽ": "ほ",
  "ゔ": "う",
  // カタカナのよみがなが紛れ込んだ場合の保険
  "ガ": "カ", "ギ": "キ", "グ": "ク", "ゲ": "ケ", "ゴ": "コ",
  "ザ": "サ", "ジ": "シ", "ズ": "ス", "ゼ": "セ", "ゾ": "ソ",
  "ダ": "タ", "ヂ": "チ", "ヅ": "ツ", "デ": "テ", "ド": "ト",
  "バ": "ハ", "ビ": "ヒ", "ブ": "フ", "ベ": "ヘ", "ボ": "ホ",
  "パ": "ハ", "ピ": "ヒ", "プ": "フ", "ペ": "ヘ", "ポ": "ホ",
  "ヴ": "ウ",
};

// ---- 50音グルーピング用キー ----
// Googleレンズ等からの貼り付けで紛れ込みやすい不可視文字（ゼロ幅スペース等）や
// 全角/半角の差異を吸収してから先頭1文字を取る。これにより見た目が同じ語が
// 別グループに分裂してしまう（同じ語が増殖して見える）のを防ぐ。
// さらに濁音・半濁音は清音の見出しにまとめる（例：「が」は「か」に含まれる）。
function normalizeKanaKey(raw: string): string {
  const cleaned = raw
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "")
    .trim();
  const first = cleaned.charAt(0) || "#";
  return DAKUTEN_MAP[first] || first;
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
  a.download = `Tango_${dateStr}.csv`;
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
  onSwitchToStock: () => void;
}

// ---- フォームの初期値 ----
const EMPTY_FORM = { word: "", reading: "", meaning: "", work: "", example: "" };

export default function VocabScreen({ user, theme, onToggleTheme, onSwitchToProgress, onSwitchToStock }: Props) {
  const [entries, setEntries] = useState<VocabEntry[]>(() => loadVocab());
  const [viewMode, setViewMode] = useState<ViewMode>("group");
  const [density, setDensity] = useState<Density>("word");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("word");
  const [favFilter, setFavFilter] = useState<FavFilter>("none");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lastWork, setLastWork] = useState(""); // 直前に入力した「登場作品」（セッション中のみ保持）
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
        setEntries(migrateEntries(cloud));
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

  // タップ（クリック）後にボタン等へ残ってしまうブラウザ既定のフォーカス枠線を強制的に外す。
  // CSSの:focus-visibleだけでは効かない環境があるため、クリックを検知して直接blur()する。
  useEffect(() => {
    function handlePointerUp(e: Event) {
      const target = e.target as HTMLElement | null;
      // input/textareaはユーザーが文字入力するためにフォーカスを保持する必要があるので対象外にする
      // （対象にすると、タップ直後に強制blurされて入力できなくなってしまう）
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const el = target?.closest<HTMLElement>(".vocab-focusable, .vocab-card");
      if (el) {
        // クリック本来の処理（onClickハンドラ）を先に走らせてからフォーカスを外す
        window.setTimeout(() => el.blur(), 0);
      }
    }
    document.addEventListener("click", handlePointerUp, true);
    return () => document.removeEventListener("click", handlePointerUp, true);
  }, []);

  // ---- フィルタ ----
  function getFiltered() {
    let result = entries;
    if (searchQuery) {
      result = searchType === "word"
        ? result.filter(e => e.word.includes(searchQuery) || (e.reading && e.reading.includes(searchQuery)))
        : result.filter(e => e.work && e.work.includes(searchQuery));
    }
    if (favFilter !== "none") result = result.filter(e => matchesFavFilter(e.favLevel || 0, favFilter));
    return result;
  }

  // ---- AI取得 ----
  async function handleAI() {
    if (!form.word.trim()) { setAiHint("先に単語を入力してください"); return; }
    setAiLoading(true);
    setAiHint("");
    try {
      const { meaning, reading } = await fetchMeaningFromAI(form.word.trim(), form.reading.trim());
      // よみがなはAIが取得できた場合のみ上書きする（取得できなかった場合は手入力済みの値を残す）
      setForm(f => ({ ...f, meaning, reading: reading || f.reading }));
      setAiHint("✓ 取得しました。編集できます。");
    } catch (e) {
      if ((e as Error & { rateLimited?: boolean })?.rateLimited) {
        setAiHint((e as Error).message);
      } else {
        setAiHint("取得できませんでした。手動で入力してください。");
      }
    } finally {
      setAiLoading(false);
    }
  }

  // ---- Googleレンズ起動 ----
  // 別タブ（スマホでは別アプリ）でGoogleレンズを開く。読み取り結果はLens側で
  // コピーしてもらい、このアプリに戻って用例欄に貼り付けてもらう想定。
  function openGoogleLens() {
    window.open("https://google.com/", "_blank", "noopener,noreferrer");
  }

  // ---- モーダル ----
  function openAdd() {
    setEditId(null);
    setForm({ ...EMPTY_FORM, work: lastWork });
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
    const workValue = form.work.trim();
    if (editId) {
      setEntries(prev => prev.map(e => e.id !== editId ? e : {
        ...e, word: form.word.trim(), reading: form.reading.trim(),
        meaning: form.meaning.trim(), work: workValue, example: form.example.trim(),
      }));
    } else {
      const entry: VocabEntry = {
        id: crypto.randomUUID(), createdAt: Date.now(),
        word: form.word.trim(), reading: form.reading.trim(),
        meaning: form.meaning.trim(), work: workValue || "作品不明",
        example: form.example.trim(),
      };
      setEntries(prev => [entry, ...prev]);
    }
    if (workValue) setLastWork(workValue);
    closeModal();
    setExpanded(null);
  }

  function deleteEntry(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id));
    if (expanded === id) setExpanded(null);
    setConfirmId(null);
  }

  function setFavLevel(id: string, level: 0 | 1 | 2 | 3) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, favLevel: level === 0 ? undefined : level } : e));
  }

  function toggleGroupCollapse(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
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
      return Object.entries(groups).map(([work, es]) => {
        const collapsed = collapsedGroups.has(work);
        return (
          <div key={work}>
            <div
              style={{ ...styles.groupLabel, display: "flex", alignItems: "center", gap: 4, cursor: "pointer", userSelect: "none" }}
              onClick={() => toggleGroupCollapse(work)}
            >
              <ChevronDown size={14} style={{ flexShrink: 0, transition: "transform 0.15s", transform: collapsed ? "rotate(-90deg)" : "none" }} />
              <span>{work}</span><span style={styles.countBadge}>{es.length}語</span>
            </div>
            {!collapsed && es.map(e => <EntryCard key={e.id} entry={e} density={density} viewMode={viewMode}
              expanded={expanded === e.id} onToggle={() => setExpanded(expanded === e.id ? null : e.id)}
              onEdit={() => openEdit(e.id)} onDelete={() => setConfirmId(e.id)} onSetFavLevel={lvl => setFavLevel(e.id, lvl)} />)}
          </div>
        );
      });
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
            onEdit={() => openEdit(e.id)} onDelete={() => setConfirmId(e.id)} onSetFavLevel={lvl => setFavLevel(e.id, lvl)} />)}
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
          <span>Tango</span>
          <span style={styles.totalCount}>{entries.length}</span>
          {syncing && <CloudUpload size={14} style={{ marginLeft: 8, opacity: 0.5, verticalAlign: "middle" }} />}
        </span>
        <div style={{ display: "flex", gap: 6, position: "relative" }}>
          <button
            className="vocab-focusable"
            style={{ ...styles.iconBtn, ...(favFilter !== "none" ? styles.iconBtnActive : {}), position: "relative" }}
            onClick={() => { setFavFilter(nextFavFilter); setExpanded(null); }}
            aria-label="お気に入りレベルで絞り込み"
          >
            <Star size={16} fill={favFilter !== "none" ? "currentColor" : "none"} />
            {favFilter !== "none" && <span style={styles.favFilterBadge}>{favFilterLabel(favFilter)}</span>}
          </button>
          <button
            className="vocab-focusable"
            style={{ ...styles.iconBtn, ...(searchOpen ? styles.iconBtnActive : {}) }}
            onClick={() => { setSearchOpen(v => !v); if (searchOpen) { setSearchQuery(""); } }}
            aria-label="検索"
          >
            <Search size={16} />
          </button>
          <button
            className="vocab-focusable"
            style={{ ...styles.iconBtn, ...(menuOpen ? styles.iconBtnActive : {}) }}
            onClick={() => setMenuOpen(v => !v)}
            aria-label="メニュー"
          >
            <Menu size={16} />
          </button>

          {menuOpen && (
            <>
              <div style={styles.menuBackdrop} onClick={() => setMenuOpen(false)} />
              <div style={styles.menuPanel}>
                <button className="vocab-focusable" style={styles.menuItem}
                  onClick={() => { setMenuOpen(false); onSwitchToProgress(); }}>
                  <BookOpen size={15} /><span>Progress Checkerへ</span>
                </button>
                <button className="vocab-focusable" style={styles.menuItem}
                  onClick={() => { setMenuOpen(false); onSwitchToStock(); }}>
                  <Package size={15} /><span>Stockへ</span>
                </button>
                <button className="vocab-focusable" style={styles.menuItem}
                  onClick={() => { setMenuOpen(false); onToggleTheme(); }}>
                  <SunMoon size={15} /><span>モード切替</span>
                </button>
                <button className="vocab-focusable" style={styles.menuItem}
                  onClick={() => { setMenuOpen(false); exportToCsv(entries); }}>
                  <Download size={15} /><span>CSV出力</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ツールバー */}
      <div style={styles.toolbar}>
        <div style={styles.seg}>
          {(["group", "kana"] as const).map((v, i) => (
            <button key={v} className="vocab-focusable" style={{ ...styles.segBtn, ...(viewMode === v ? styles.segBtnActive : {}), ...(i > 0 ? { borderLeft: "0.5px solid var(--border)" } : {}) }}
              onClick={() => { setViewMode(v); setExpanded(null); }}>
              {v === "group" ? "作品別" : "50音順"}
            </button>
          ))}
        </div>
        <div style={{ width: "0.5px", height: 20, background: "var(--border)", margin: "0 2px" }} />
        <div style={styles.seg}>
          {(["word", "meaning", "all"] as const).map((v, i) => (
            <button key={v} className="vocab-focusable" style={{ ...styles.segBtn, ...(density === v ? styles.segBtnActive : {}), ...(i > 0 ? { borderLeft: "0.5px solid var(--border)" } : {}) }}
              onClick={() => { setDensity(v); setExpanded(null); }}>
              {v === "word" ? "単語" : v === "meaning" ? "＋よみ" : "＋意味"}
            </button>
          ))}
        </div>
        <span style={styles.filteredCount}>{filtered.length}語</span>
      </div>

      {/* 検索バー */}
      {searchOpen && (
        <div style={styles.searchBar}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input ref={searchRef} style={styles.searchInput} value={searchQuery} placeholder="検索…"
              onChange={e => { setSearchQuery(e.target.value); setExpanded(null); }} />
            <button className="vocab-focusable" style={styles.iconBtn} onClick={() => { setSearchOpen(false); setSearchQuery(""); }} aria-label="閉じる"><X size={16} /></button>
          </div>
          <div style={{ display: "flex", gap: 0, marginTop: 6, border: "0.5px solid var(--border)", borderRadius: 6, overflow: "hidden", width: "fit-content" }}>
            {(["word", "work"] as const).map((v, i) => (
              <button key={v} className="vocab-focusable" style={{ ...styles.segBtn, ...(searchType === v ? styles.segBtnActive : {}), ...(i > 0 ? { borderLeft: "0.5px solid var(--border)" } : {}) }}
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
      <button className="vocab-focusable" style={styles.fab} onClick={openAdd} aria-label="単語を追加"><Plus size={22} /></button>

      {/* 追加・編集モーダル */}
      {modalOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <p style={styles.modalTitle}>{editId ? "単語を編集" : "単語を追加"}</p>

            <FormGroup label="単語">
              <input className="vocab-focusable" style={styles.input} value={form.word} placeholder="例：逡巡"
                onChange={e => setForm(f => ({ ...f, word: e.target.value }))} />
            </FormGroup>

            <FormGroup label="よみがな（任意）">
              <input className="vocab-focusable" style={styles.input} value={form.reading} placeholder="例：しゅんじゅん"
                onChange={e => setForm(f => ({ ...f, reading: e.target.value }))} />
            </FormGroup>

            <FormGroup label="意味">
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <textarea className="vocab-focusable" rows={3} style={{ ...styles.input, ...styles.textarea, flex: 1 }} value={form.meaning}
                  placeholder="ここに意味を入力、またはAIで取得"
                  onChange={e => setForm(f => ({ ...f, meaning: e.target.value }))} />
                <button className="vocab-focusable" style={styles.aiBtn} onClick={handleAI} disabled={aiLoading} aria-label="AIで意味とよみがなを取得">
                  {aiLoading ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Sparkles size={13} />}
                  <span>{aiLoading ? "取得中" : "AI取得"}</span>
                </button>
              </div>
              {aiHint && <div style={styles.aiHint}>{aiHint}</div>}
              {!aiHint && <div style={styles.aiHint}>意味とよみがなを取得します（取得できた場合はよみがな欄も上書きされます。よみがなを先に入力しておくと精度が上がります）</div>}
            </FormGroup>

            <FormGroup label="登場作品">
              <input className="vocab-focusable" style={styles.input} value={form.work} placeholder="例：砂の女"
                onChange={e => setForm(f => ({ ...f, work: e.target.value }))} />
            </FormGroup>

            <FormGroup label="用例文">
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <textarea className="vocab-focusable" rows={3} style={{ ...styles.input, ...styles.textarea, flex: 1 }} value={form.example}
                  placeholder="作品中の文章をここに"
                  onChange={e => setForm(f => ({ ...f, example: e.target.value }))} />
                <button className="vocab-focusable" style={styles.aiBtn} onClick={openGoogleLens} aria-label="Googleレンズを開く">
                  <ScanText size={13} />
                  <span>Lens</span>
                </button>
              </div>
              <div style={styles.aiHint}>Lensで読み取った文字をコピーして、ここに貼り付け</div>
            </FormGroup>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="vocab-focusable" style={styles.btnCancel} onClick={closeModal}>キャンセル</button>
              <button className="vocab-focusable" style={styles.btnSave} onClick={saveEntry}>{editId ? "保存する" : "追加する"}</button>
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
              <button className="vocab-focusable" style={styles.btnCancel} onClick={() => setConfirmId(null)}>キャンセル</button>
              <button className="vocab-focusable" style={styles.btnDel} onClick={() => deleteEntry(confirmId)}>削除</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .vocab-preview-meaning {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 1;
          line-clamp: 1;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (max-width: 640px) {
          .vocab-preview-meaning {
            -webkit-line-clamp: 2;
            line-clamp: 2;
          }
        }
        /* デバイス・ブラウザを問わず再現するとのことなので、コンポーネント内のCSSだけでは
           theme.css側のグローバルなフォーカス/アクティブ装飾に負けている可能性を考慮し、
           !importantで確実に上書きする。box-shadowやtap-highlightも合わせて無効化。 */
        .vocab-card,
        .vocab-card *,
        .vocab-focusable {
          -webkit-tap-highlight-color: transparent !important;
        }
        .vocab-card,
        .vocab-card *,
        .vocab-focusable,
        .vocab-card:focus,
        .vocab-card:active,
        .vocab-card:focus-within,
        .vocab-focusable:focus,
        .vocab-focusable:active {
          outline: none !important;
          box-shadow: none !important;
        }
        .vocab-focusable:focus-visible {
          outline: 2px solid var(--accent-primary, #7aa2f7) !important;
          outline-offset: 1px;
        }
        .vocab-card:focus-visible {
          outline: 2px solid var(--accent-primary, #7aa2f7) !important;
          outline-offset: 1px;
        }
      `}</style>
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
  onSetFavLevel: (level: 0 | 1 | 2 | 3) => void;
}

function EntryCard({ entry: e, density, viewMode, expanded, onToggle, onEdit, onDelete, onSetFavLevel }: CardProps) {
  // 折り畳み中の常時表示
  // 単語:      単語のみ
  // ＋よみがな: 単語＋よみがな  (density === "meaning")
  // ＋意味:    単語＋よみがな＋意味  (density === "all")
  const showReadingInline = (density === "meaning" || density === "all" || (density === "word" && expanded)) && e.reading;
  const showMeaningPreview = density === "all" && e.meaning && !expanded;
  const favLevel = e.favLevel || 0;

  // 展開時の追加表示（常時表示に出ていないものだけ）
  const expandShowReading = false; // よみがなは常にインライン表示するので詳細セクションには出さない
  const expandShowMeaning = !!e.meaning;
  const expandShowExample = !!e.example;
  const expandShowWork = viewMode === "kana" && !!e.work;
  const hasDetail = expandShowReading || expandShowMeaning || expandShowExample || expandShowWork;

  return (
    <div
      className="vocab-card vocab-focusable"
      style={{ ...styles.card, ...(expanded ? styles.cardExpanded : {}) }}
      onClick={e2 => { if ((e2.target as HTMLElement).closest("[data-action]")) return; if (hasDetail) onToggle(); }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={styles.word}>{e.word}</span>
            {showReadingInline && <span style={styles.reading}>{e.reading}</span>}
          </div>
          {showMeaningPreview && <div className="vocab-preview-meaning" style={styles.previewMeaning}>{e.meaning}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <div data-action="favorite" style={styles.favStarRow}>
            {([1, 2, 3] as const).map(n => (
              <button
                key={n}
                className="vocab-focusable"
                style={{ ...styles.favStarBtn, marginLeft: n > 1 ? -4 : 0, color: n <= favLevel ? "#e0af68" : "var(--text-dim)" }}
                onClick={e2 => { e2.stopPropagation(); onSetFavLevel(n === favLevel ? 0 : n); }}
                aria-label={`★${n}に設定`}
              >
                <span style={{ fontSize: 20, lineHeight: 1 }}>{n <= favLevel ? "★" : "☆"}</span>
              </button>
            ))}
          </div>
          {expanded && (
            <>
              <button data-action="edit" className="vocab-focusable" style={styles.actBtn} onClick={e2 => { e2.stopPropagation(); onEdit(); }} aria-label="編集">
                <Pencil size={14} />
              </button>
              <button data-action="del" className="vocab-focusable" style={{ ...styles.actBtn, ...styles.actBtnDel }} onClick={e2 => { e2.stopPropagation(); onDelete(); }} aria-label="削除">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
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
  headerTitle: { fontSize: 20, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "baseline", gap: 6 },
  totalCount: { fontSize: 20, fontWeight: 700, color: "var(--accent-primary, #7aa2f7)" },
  iconBtn: { background: "var(--bg-surface)", borderWidth: "0.5px", borderStyle: "solid", borderColor: "var(--border)", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)" },
  iconBtnActive: { background: "color-mix(in srgb, var(--accent-primary) 13%, transparent)", borderColor: "var(--accent-primary)", color: "var(--accent-primary)" },
  favFilterBadge: { position: "absolute", top: -4, right: -4, background: "#e0af68", color: "var(--text-on-accent)", fontSize: 9, fontWeight: 700, borderRadius: 100, minWidth: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: "0 2px" },
  menuBackdrop: { position: "fixed", inset: 0, zIndex: 59 },
  menuPanel: { position: "absolute", top: 40, right: 0, background: "var(--bg-overlay)", border: "0.5px solid var(--border)", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.3)", zIndex: 60, minWidth: 180, padding: 4, display: "flex", flexDirection: "column" },
  menuItem: { display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", background: "transparent", border: "none", borderRadius: 6, color: "var(--text-primary)", fontSize: 13, cursor: "pointer", textAlign: "left" },
  toolbar: { background: "var(--bg-surface)", borderBottom: "0.5px solid var(--border)", padding: "8px 16px", display: "flex", gap: 6, alignItems: "center" },
  seg: { display: "flex", border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden" },
  segBtn: { padding: "5px 10px", fontSize: 12, background: "var(--bg-surface)", color: "var(--text-muted)", border: "none", cursor: "pointer", whiteSpace: "nowrap" },
  segBtnActive: { background: "var(--accent-primary)", color: "var(--bg-base)", fontWeight: 500 },
  filteredCount: { marginLeft: "auto", fontSize: 12, color: "var(--accent-primary, #7aa2f7)", whiteSpace: "nowrap" },
  searchBar: { padding: "8px 16px", background: "var(--bg-surface)", borderBottom: "0.5px solid var(--border)" },
  searchInput: { flex: 1, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, width: "100%" },
  content: { padding: "12px 16px" },
  groupLabel: { fontSize: 12, fontWeight: 500, color: "var(--text-muted)", padding: "14px 0 6px", letterSpacing: "0.03em" },
  countBadge: { fontSize: 12, color: "var(--text-dim)", fontWeight: 400, marginLeft: 5 },
  card: { background: "var(--bg-surface)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)", borderRadius: 12, padding: "11px 14px", marginBottom: 7, cursor: "pointer" },
  cardExpanded: { borderColor: "var(--text-dim)" },
  word: { fontSize: 16, fontWeight: 500, color: "var(--text-primary)" },
  reading: { fontSize: 13, color: "var(--text-muted)" },
  previewMeaning: { fontSize: 13, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.5 },
  detail: { marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 },
  detailLabel: { fontSize: 11, fontWeight: 500, color: "var(--text-dim)", letterSpacing: "0.04em", marginBottom: 2 },
  detailText: { fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 },
  exampleBox: { fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, background: "var(--bg-overlay)", borderRadius: 8, padding: "8px 10px", borderLeft: "2.5px solid var(--border-dim)" },
  workTag: { display: "inline-block", fontSize: 11, background: "var(--bg-overlay)", color: "var(--text-muted)", border: "0.5px solid var(--border)", borderRadius: 100, padding: "2px 8px" },
  actBtn: { width: 30, height: 30, borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--bg-overlay)", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  actBtnDel: {},
  favStarRow: { display: "flex", alignItems: "center" },
  favStarBtn: { width: 24, height: 30, border: "none", background: "transparent", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  empty: { textAlign: "center", padding: "40px 0", color: "var(--text-dim)", fontSize: 14 },
  fab: { position: "fixed", bottom: 24, right: 20, width: 48, height: 48, borderRadius: "50%", background: "var(--accent-primary)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--bg-base)" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", zIndex: 50 },
  modal: { background: "var(--bg-surface)", borderRadius: "16px 16px 0 0", padding: "20px 16px 32px", width: "100%", maxWidth: 600, margin: "0 auto" },
  modalTitle: { fontSize: 16, fontWeight: 500, color: "var(--text-primary)", marginBottom: 14 },
  input: { width: "100%", padding: "8px 10px", border: "0.5px solid var(--border)", borderRadius: 8, background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, fontFamily: "inherit" },
  textarea: { resize: "vertical", minHeight: 88, lineHeight: 1.6 },
  aiBtn: { flexShrink: 0, padding: "0 10px", height: 38, border: "0.5px solid var(--accent-primary)", borderRadius: 8, background: "color-mix(in srgb, var(--accent-primary) 13%, transparent)", color: "var(--accent-primary)", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" },
  aiHint: { fontSize: 11, color: "var(--text-dim)", marginTop: 3 },
  btnCancel: { flex: 1, padding: 10, border: "0.5px solid var(--border)", borderRadius: 8, background: "var(--bg-overlay)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" },
  btnSave: { flex: 2, padding: 10, border: "none", borderRadius: 8, background: "var(--accent-primary)", color: "var(--bg-base)", fontSize: 14, fontWeight: 500, cursor: "pointer" },
  confirmBox: { background: "var(--bg-surface)", borderRadius: 12, padding: 20, width: 260, textAlign: "center" },
  btnDel: { flex: 1, padding: 10, border: "none", borderRadius: 8, background: "#f7768e", color: "#1a1b26", fontSize: 14, fontWeight: 500, cursor: "pointer" },
};
