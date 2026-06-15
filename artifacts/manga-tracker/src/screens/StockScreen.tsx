import { useState, useEffect, useRef } from "react";
import {
  Plus, X, Package,
  LockKeyhole, LockKeyholeOpen, Snail, User as UserIcon,
  LogOut, SunMoon, BookOpen, Pencil, Trash2,
} from "lucide-react";
import type { StockItem, StockRefill, StockAccentColor } from "../types";
import { loadStockFromCloud, saveStockToCloud } from "../storage";
import type { User } from "@supabase/supabase-js";

// ---------- アクセントカラー ----------

const STOCK_COLORS: Record<StockAccentColor, { hex: string; label: string }> = {
  blue:  { hex: "#7aa2f7", label: "ブルー" },
  green: { hex: "#9ece6a", label: "グリーン" },
  red:   { hex: "#f7768e", label: "レッド" },
};

// ---------- ユーティリティ ----------

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function applyDailyConsumption(item: StockItem): StockItem {
  const todayStart = startOfDay(Date.now());
  const lastStart = startOfDay(item.lastUpdated);
  const elapsedDays = Math.floor((todayStart - lastStart) / 86400000);
  if (elapsedDays <= 0) return item;
  const dailyUse = item.consumeAmount / item.consumeDays;
  const consumed = dailyUse * elapsedDays;
  return { ...item, quantity: Math.max(0, item.quantity - consumed), lastUpdated: todayStart };
}

function daysUntilEmpty(item: StockItem): number {
  const dailyUse = item.consumeAmount / item.consumeDays;
  if (dailyUse <= 0) return Infinity;
  return item.quantity / dailyUse;
}

function formatDate(daysFromNow: number): string {
  if (!isFinite(daysFromNow)) return "—";
  const d = new Date();
  d.setDate(d.getDate() + Math.ceil(daysFromNow));
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}月${d.getDate()}日 (${weekdays[d.getDay()]})`;
}

function accentHex(item: StockItem): string {
  return STOCK_COLORS[item.accentColor ?? "blue"].hex;
}

// ---------- ローカルストレージ ----------

const STOCK_KEY = "stock-items";

function loadStockItems(): StockItem[] {
  try {
    const raw = localStorage.getItem(STOCK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveStockItems(items: StockItem[]) {
  localStorage.setItem(STOCK_KEY, JSON.stringify(items));
}

// ---------- inputStyle ----------

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "10px 12px",
  fontSize: "15px",
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
};

// ---------- 残量バー ----------

function QuantityBar({ item }: { item: StockItem }) {
  if (!item.capacity) return null;
  const pct = Math.min(100, (item.quantity / item.capacity) * 100);
  const hex = accentHex(item);
  return (
    <div style={{ height: "5px", borderRadius: "3px", background: "var(--border-dim)", marginBottom: "8px" }}>
      <div style={{ height: "5px", borderRadius: "3px", width: `${pct}%`, background: hex, transition: "width 0.3s" }} />
    </div>
  );
}

// ---------- アイテム追加・編集フォーム ----------

function ItemFormSheet({
  initial, onSave, onClose,
}: {
  initial?: StockItem;
  onSave: (data: Omit<StockItem, "id" | "lastUpdated" | "history">) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [quantity, setQuantity] = useState(initial ? String(Math.round(initial.quantity * 10) / 10) : "");
  const [consumeAmount, setConsumeAmount] = useState(initial ? String(initial.consumeAmount) : "");
  const [consumeDays, setConsumeDays] = useState(initial ? String(initial.consumeDays) : "1");
  const [capacity, setCapacity] = useState(initial?.capacity != null ? String(initial.capacity) : "");
  const [accentColor, setAccentColor] = useState<StockAccentColor>(initial?.accentColor ?? "blue");

  const canSave =
    name.trim() !== "" && unit.trim() !== "" &&
    quantity !== "" && !isNaN(Number(quantity)) &&
    consumeAmount !== "" && Number(consumeAmount) > 0 &&
    consumeDays !== "" && Number(consumeDays) > 0;

  function handleSave() {
    if (!canSave) return;
    onSave({
      name: name.trim(), unit: unit.trim(),
      quantity: Number(quantity),
      consumeAmount: Number(consumeAmount),
      consumeDays: Number(consumeDays),
      capacity: capacity !== "" ? Number(capacity) : undefined,
      accentColor,
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: "512px", margin: "0 auto", background: "var(--bg-overlay)", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px", boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "var(--border)", margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
            {initial ? "アイテムを編集" : "アイテムを追加"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* カラー */}
          <div>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>カテゴリカラー</label>
            <div style={{ display: "flex", gap: "10px" }}>
              {(Object.keys(STOCK_COLORS) as StockAccentColor[]).map((c) => {
                const hex = STOCK_COLORS[c].hex;
                const selected = accentColor === c;
                return (
                  <button
                    key={c}
                    onClick={() => setAccentColor(c)}
                    style={{
                      flex: 1, padding: "10px 4px", borderRadius: "10px",
                      border: selected ? `2px solid ${hex}` : "1px solid var(--border)",
                      background: selected ? `${hex}22` : "var(--bg-surface)",
                      color: selected ? hex : "var(--text-muted)",
                      fontSize: "13px", fontWeight: selected ? 700 : 400,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    }}
                  >
                    <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: hex, display: "inline-block", flexShrink: 0 }} />
                    {STOCK_COLORS[c].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* アイテム名 */}
          <div>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>アイテム名 *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="シャンプー" style={inputStyle} autoFocus />
          </div>

          {/* 単位 */}
          <div>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>単位 *</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ml、g、個、枚..." style={inputStyle} />
          </div>

          {/* 現在の残量 */}
          <div>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>現在の残量 *</label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="70" style={{ ...inputStyle, flex: 1 }} />
              <span style={{ fontSize: "14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{unit || "単位"}</span>
            </div>
          </div>

          {/* 消費ペース */}
          <div>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>消費ペース *</label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="number" value={consumeDays} onChange={(e) => setConsumeDays(e.target.value)} placeholder="1" style={{ ...inputStyle, width: "60px", textAlign: "center" }} />
              <span style={{ fontSize: "14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>日に</span>
              <input type="number" value={consumeAmount} onChange={(e) => setConsumeAmount(e.target.value)} placeholder="5" style={{ ...inputStyle, width: "60px", textAlign: "center" }} />
              <span style={{ fontSize: "14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{unit || "単位"} 消費</span>
            </div>
          </div>

          {/* 容量（任意） */}
          <div>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
              容量（任意）
              <span style={{ fontSize: "11px", marginLeft: "6px", color: "var(--text-dim)" }}>— 残量バーの基準</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="400" style={{ ...inputStyle, flex: 1 }} />
              <span style={{ fontSize: "14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{unit || "単位"}</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            marginTop: "24px", width: "100%", padding: "14px", borderRadius: "14px", border: "none",
            background: canSave ? STOCK_COLORS[accentColor].hex : "var(--border)",
            color: canSave ? "#1a1b26" : "var(--text-dim)",
            fontSize: "15px", fontWeight: 600, cursor: canSave ? "pointer" : "default", transition: "background 0.15s",
          }}
        >
          {initial ? "保存する" : "追加する"}
        </button>
      </div>
    </div>
  );
}

// ---------- 補充シート ----------

function RefillSheet({ item, onRefill, onClose }: { item: StockItem; onRefill: (amount: number) => void; onClose: () => void }) {
  const [input, setInput] = useState("");
  const amount = Number(input);
  const newQty = item.quantity + (isNaN(amount) ? 0 : amount);
  const newDays = daysUntilEmpty({ ...item, quantity: newQty });
  const hex = accentHex(item);

  const presets = item.capacity
    ? [Math.round(item.capacity * 0.25), Math.round(item.capacity * 0.5), item.capacity]
    : [];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: "512px", margin: "0 auto", background: "var(--bg-overlay)", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px", boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "var(--border)", margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>{item.name}を補充</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: "13px", color: "var(--text-muted)" }}>
          現在の残量：{Math.round(item.quantity * 10) / 10}{item.unit}{item.capacity ? `（容量：${item.capacity}${item.unit}）` : ""}
        </p>

        {presets.length > 0 && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {presets.map((p, i) => (
              <button key={i} onClick={() => setInput(String(p))} style={{
                flex: 1, padding: "10px 4px", borderRadius: "10px",
                border: input === String(p) ? `1.5px solid ${hex}` : "1px solid var(--border)",
                background: input === String(p) ? `${hex}22` : "var(--bg-surface)",
                color: input === String(p) ? hex : "var(--text-sub)",
                fontSize: "12px", fontWeight: 500, cursor: "pointer",
              }}>
                {i < presets.length - 1 ? `+${p}${item.unit}` : `新品1本\n+${p}${item.unit}`}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
          <input
            type="number" value={input} onChange={(e) => setInput(e.target.value)} placeholder="0"
            style={{ flex: 1, fontSize: "24px", fontWeight: 500, textAlign: "right", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 14px", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }}
          />
          <span style={{ fontSize: "15px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{item.unit} 補充</span>
        </div>

        {amount > 0 && (
          <div style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "12px 16px", marginBottom: "18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {[
              { val: `${Math.round(item.quantity * 10) / 10}${item.unit}`, label: "補充前", color: "var(--text-primary)" },
              { val: "→", label: "", color: "var(--text-dim)" },
              { val: `${Math.round(newQty * 10) / 10}${item.unit}`, label: "補充後", color: hex },
              { val: "→", label: "", color: "var(--text-dim)" },
              { val: isFinite(newDays) ? `${Math.ceil(newDays)}日後` : "—", label: "切れる予測", color: "#9ece6a" },
            ].map(({ val, label, color }, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: label ? "14px" : "16px", fontWeight: 500, color }}>{val}</div>
                {label && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{label}</div>}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => { if (amount > 0) { onRefill(amount); onClose(); } }}
          disabled={!amount || amount <= 0}
          style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "none", background: amount > 0 ? hex : "var(--border)", color: amount > 0 ? "#1a1b26" : "var(--text-dim)", fontSize: "15px", fontWeight: 600, cursor: amount > 0 ? "pointer" : "default" }}
        >
          この量で補充を記録
        </button>
      </div>
    </div>
  );
}

// ---------- 補充履歴の1行（長押し/右クリックで削除） ----------

function RefillHistoryRow({ refill, unit, onDelete }: { refill: StockRefill; unit: string; onDelete: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressing, setPressing] = useState(false);

  const d = new Date(refill.date);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const dateStr = `${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;

  function startPress() {
    setPressing(true);
    timerRef.current = setTimeout(() => {
      setPressing(false);
      if (window.confirm(`「+${refill.amount}${unit} 補充」を削除しますか？`)) onDelete();
    }, 600);
  }
  function endPress() {
    setPressing(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  return (
    <div
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onContextMenu={(e) => {
        e.preventDefault();
        if (window.confirm(`「+${refill.amount}${unit} 補充」を削除しますか？`)) onDelete();
      }}
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 14px",
        background: pressing ? "var(--bg-surface)" : "transparent",
        cursor: "pointer",
        userSelect: "none",
        transition: "background 0.1s",
      }}
    >
      <div>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>+{refill.amount}{unit} 補充</div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{dateStr}</div>
      </div>
      <div style={{ fontSize: "14px", fontWeight: 600, color: "#7aa2f7" }}>+{refill.amount}{unit}</div>
    </div>
  );
}

// ---------- 詳細シート ----------

function DetailSheet({ item, onRefill, onDeleteRefill, onEdit, onDelete, onClose }: {
  item: StockItem;
  onRefill: (amount: number) => void;
  onDeleteRefill: (refillId: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [showRefill, setShowRefill] = useState(false);
  const days = daysUntilEmpty(item);
  const hex = accentHex(item);
  const pct = item.capacity ? Math.min(100, (item.quantity / item.capacity) * 100) : null;

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
        <div
          style={{ width: "100%", maxWidth: "512px", margin: "0 auto", background: "var(--bg-overlay)", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px", boxSizing: "border-box", maxHeight: "85vh", overflowY: "auto" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "var(--border)", margin: "0 auto 20px" }} />

          {/* ヘッダー */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>{item.name}</h2>
              <span style={{ display: "inline-block", fontSize: "12px", padding: "3px 10px", borderRadius: "20px", border: `1px solid ${hex}`, background: `${hex}22`, color: hex, fontWeight: 500 }}>
                {isFinite(days) ? `${Math.ceil(days)}日後に切れる` : "消費なし"}
              </span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={onEdit} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "6px 10px", cursor: "pointer", color: "var(--text-muted)" }}><Pencil size={15} /></button>
              <button onClick={onDelete} style={{ background: "#f7768e22", border: "1px solid #f7768e", borderRadius: "10px", padding: "6px 10px", cursor: "pointer", color: "#f7768e" }}><Trash2 size={15} /></button>
              <button onClick={onClose} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "6px 10px", cursor: "pointer", color: "var(--text-muted)" }}><X size={15} /></button>
            </div>
          </div>

          {/* 残量バー */}
          {pct !== null && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>
                <span>残量</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{Math.round(item.quantity * 10) / 10} / {item.capacity}{item.unit}</span>
              </div>
              <div style={{ height: "8px", borderRadius: "4px", background: "var(--border-dim)" }}>
                <div style={{ height: "8px", borderRadius: "4px", width: `${pct}%`, background: hex, transition: "width 0.3s" }} />
              </div>
            </div>
          )}

          {/* 統計 3カラム */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "18px" }}>
            <div style={{ background: "var(--bg-surface)", borderRadius: "10px", padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{Math.round(item.quantity * 10) / 10}{item.unit}</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>残量</div>
            </div>
            <div style={{ background: "var(--bg-surface)", borderRadius: "10px", padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{item.consumeAmount}{item.unit}/{item.consumeDays}日</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>消費ペース</div>
            </div>
            <div style={{ background: "var(--bg-surface)", borderRadius: "10px", padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>{isFinite(days) ? formatDate(days) : "—"}</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>切れる日</div>
            </div>
          </div>

          {/* 補充ボタン */}
          <button
            onClick={() => setShowRefill(true)}
            style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "none", background: hex, color: "#1a1b26", fontSize: "15px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "20px" }}
          >
            <Package size={18} /> 補充
          </button>

          {/* 補充履歴 */}
          {item.history.length > 0 && (
            <>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                補充履歴
                <span style={{ fontSize: "11px", fontWeight: 400, marginLeft: "8px", color: "var(--text-dim)" }}>長押しで削除</span>
              </div>
              <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
                {[...item.history].reverse().map((h, i) => (
                  <div key={h.id}>
                    {i > 0 && <div style={{ borderTop: "1px solid var(--border)" }} />}
                    <RefillHistoryRow
                      refill={h}
                      unit={item.unit}
                      onDelete={() => onDeleteRefill(h.id)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {showRefill && (
        <RefillSheet item={item} onRefill={onRefill} onClose={() => setShowRefill(false)} />
      )}
    </>
  );
}

// ---------- メイン画面 ----------

interface Props {
  user: User | null;
  locked: boolean;
  theme: "dark" | "light" | "sepia";
  onToggleTheme: () => void;
  onToggleLock: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSwitchToProgress: () => void;
}

export default function StockScreen({ user, locked, theme, onToggleTheme, onToggleLock, onSignIn, onSignOut, onSwitchToProgress }: Props) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<StockItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<StockItem | null>(null);

  useEffect(() => {
    async function load() {
      let loaded: StockItem[] = [];
      if (user) {
        const cloud = await loadStockFromCloud(user.id);
        if (cloud) {
          loaded = cloud;
        } else {
          // クラウドにデータなし → localStorageから移行
          loaded = loadStockItems();
          if (loaded.length > 0) await saveStockToCloud(user.id, loaded);
        }
      } else {
        loaded = loadStockItems();
      }
      const updated = loaded.map(applyDailyConsumption);
      setItems(updated);
      saveStockItems(updated);
      if (user) await saveStockToCloud(user.id, updated);
    }
    load();
  }, [user]);

  function mutate(updater: (prev: StockItem[]) => StockItem[]) {
    setItems((prev) => {
      const next = updater(prev);
      saveStockItems(next);
      if (user) saveStockToCloud(user.id, next);
      return next;
    });
  }

  function addItem(data: Omit<StockItem, "id" | "lastUpdated" | "history">) {
    const item: StockItem = { ...data, id: crypto.randomUUID(), lastUpdated: startOfDay(Date.now()), history: [] };
    mutate((prev) => [item, ...prev]);
  }

  function editItem(id: string, data: Omit<StockItem, "id" | "lastUpdated" | "history">) {
    mutate((prev) => prev.map((it) => it.id !== id ? it : { ...it, ...data, lastUpdated: startOfDay(Date.now()) }));
    setDetailTarget((prev) => prev ? { ...prev, ...data, lastUpdated: startOfDay(Date.now()) } : null);
  }

  function deleteItem(id: string) {
    mutate((prev) => prev.filter((it) => it.id !== id));
    setDetailTarget(null);
  }

  function refillItem(id: string, amount: number) {
    const refill: StockRefill = { id: crypto.randomUUID(), date: Date.now(), amount };
    mutate((prev) => prev.map((it) => it.id !== id ? it : { ...it, quantity: it.quantity + amount, lastUpdated: startOfDay(Date.now()), history: [...it.history, refill] }));
    setDetailTarget((prev) => prev && prev.id === id ? { ...prev, quantity: prev.quantity + amount, history: [...prev.history, refill] } : prev);
  }

  function deleteRefill(itemId: string, refillId: string) {
    mutate((prev) => prev.map((it) => {
      if (it.id !== itemId) return it;
      const refill = it.history.find((h) => h.id === refillId);
      const deduct = refill ? refill.amount : 0;
      return {
        ...it,
        quantity: Math.max(0, it.quantity - deduct),
        history: it.history.filter((h) => h.id !== refillId),
      };
    }));
    setDetailTarget((prev) => {
      if (!prev || prev.id !== itemId) return prev;
      const refill = prev.history.find((h) => h.id === refillId);
      const deduct = refill ? refill.amount : 0;
      return {
        ...prev,
        quantity: Math.max(0, prev.quantity - deduct),
        history: prev.history.filter((h) => h.id !== refillId),
      };
    });
  }

  const sorted = [...items].sort((a, b) => daysUntilEmpty(a) - daysUntilEmpty(b));
  const urgentItems = sorted.filter((it) => daysUntilEmpty(it) <= 7);
  const soonItems   = sorted.filter((it) => { const d = daysUntilEmpty(it); return d > 7 && d <= 30; });
  const okItems     = sorted.filter((it) => daysUntilEmpty(it) > 30);

  function renderItem(item: StockItem) {
    const days = daysUntilEmpty(item);
    const hex = accentHex(item);
    return (
      <button
        key={item.id}
        onClick={() => setDetailTarget(item)}
        style={{
          width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "13px 16px", background: "var(--bg-surface)",
          border: `1px solid var(--border)`,
          borderLeft: `3px solid ${hex}`,
          borderRadius: "14px", cursor: "pointer", marginBottom: "8px", gap: "12px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.name}
          </div>
          <QuantityBar item={item} />
          <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>残 {Math.round(item.quantity * 10) / 10}{item.unit}</span>
            <span style={{ color: "var(--border)", fontSize: "14px" }}>|</span>
            <span>{item.consumeAmount}{item.unit}/{item.consumeDays}日</span>
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: hex, whiteSpace: "nowrap" }}>
            {isFinite(days) ? `${Math.ceil(days)}日後` : "—"}
          </div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-sub)", marginTop: "3px", whiteSpace: "nowrap" }}>
            {isFinite(days) ? formatDate(days) : ""}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" onClick={() => setShowUserMenu(false)}>
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-[var(--bg-base)]/95 backdrop-blur-md border-b border-[var(--border-dim)] px-4 pt-2 pb-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold" style={{ color: theme === "sepia" ? "#c0392b" : "var(--text-primary)" }}>Stock</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
                className="w-9 h-9 flex items-center justify-center rounded-xl border active:scale-95 transition-all"
                style={locked ? { backgroundColor: "#f7768e22", borderColor: "#f7768e", color: "#f7768e" } : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                {locked ? <LockKeyhole size={16} /> : <LockKeyholeOpen size={16} />}
              </button>
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowUserMenu((v) => !v); }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] active:scale-95 transition-transform"
                  style={{ color: user ? "#80c9ca" : "var(--text-muted)" }}
                >
                  {user ? <Snail size={20} /> : <UserIcon size={20} />}
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 top-11 z-30 bg-[var(--bg-overlay)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { onSwitchToProgress(); setShowUserMenu(false); }} className="w-full px-4 py-3 text-left text-sm text-[var(--text-sub)] hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-2">
                      <BookOpen size={16} /> Progress Checker
                    </button>
                    <div className="border-t border-[var(--border)]" />
                    {user ? (
                      <button onClick={() => { onSignOut(); setShowUserMenu(false); }} className="w-full px-4 py-3 text-left text-sm text-[var(--text-sub)] hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-2">
                        <LogOut size={16} /> ログアウト
                      </button>
                    ) : (
                      <button onClick={() => { onSignIn(); setShowUserMenu(false); }} className="w-full px-4 py-3 text-left text-sm text-[var(--text-sub)] hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-2">
                        <UserIcon size={16} /> ログイン
                      </button>
                    )}
                    <div className="border-t border-[var(--border)]" />
                    <button onClick={() => { onToggleTheme(); setShowUserMenu(false); }} className="w-full px-4 py-3 text-left text-sm text-[var(--text-sub)] hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-2">
                      <SunMoon size={16} /> モード切替
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* メイン */}
      <main className="flex-1 px-3 py-3 max-w-lg mx-auto w-full pb-32">
        {items.length === 0 ? (
          <div className="mt-20 text-center space-y-2">
            <p className="text-4xl">📦</p>
            <p className="text-[var(--text-muted)] text-sm">在庫アイテムがありません</p>
            <p className="text-[var(--text-dim)] text-xs">下のボタンから追加しましょう</p>
          </div>
        ) : (
          <>
            {urgentItems.length > 0 && (
              <>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", margin: "4px 2px 8px" }}>残りわずか</p>
                {urgentItems.map(renderItem)}
              </>
            )}
            {soonItems.length > 0 && (
              <>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", margin: `${urgentItems.length > 0 ? "16px" : "4px"} 2px 8px` }}>もうすぐ切れる</p>
                {soonItems.map(renderItem)}
              </>
            )}
            {okItems.length > 0 && (
              <>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", margin: `${urgentItems.length > 0 || soonItems.length > 0 ? "16px" : "4px"} 2px 8px` }}>余裕あり</p>
                {okItems.map(renderItem)}
              </>
            )}
          </>
        )}
      </main>

      {/* 追加ボタン */}
      {!locked && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)]/90 to-transparent">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => setShowAdd(true)}
              className="w-full font-bold py-4 rounded-2xl text-base active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              style={{ backgroundColor: "#7aa2f7", color: "#1a1b26", boxShadow: "0 4px 24px #7aa2f733" }}
            >
              <Plus size={20} /> アイテムを追加
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <ItemFormSheet onSave={(data) => { addItem(data); setShowAdd(false); }} onClose={() => setShowAdd(false)} />
      )}
      {editTarget && (
        <ItemFormSheet initial={editTarget} onSave={(data) => { editItem(editTarget.id, data); setEditTarget(null); }} onClose={() => setEditTarget(null)} />
      )}
      {detailTarget && (
        <DetailSheet
          item={detailTarget}
          onRefill={(amount) => refillItem(detailTarget.id, amount)}
          onDeleteRefill={(refillId) => deleteRefill(detailTarget.id, refillId)}
          onEdit={() => { setEditTarget(detailTarget); setDetailTarget(null); }}
          onDelete={() => { if (!window.confirm(`「${detailTarget.name}」を削除しますか？`)) return; deleteItem(detailTarget.id); }}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </div>
  );
}
