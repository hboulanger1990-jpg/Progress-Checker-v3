import { supabase } from "./lib/supabase";
import type { Folder, Section } from "./types";

const LOCAL_KEY = "progress-checker-v3";


// ---- ローカル（未ログイン時） ----
export function loadFolders(): Folder[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as Folder[];
  } catch {}
  return [];
}

export function saveFolders(folders: Folder[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(folders));
  } catch {}
}

// ---- Supabase（ログイン時） ----
export async function loadFoldersFromCloud(userId: string): Promise<Folder[] | null> {
  const { data, error } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.data as Folder[];
}

export async function saveFoldersToCloud(userId: string, folders: Folder[]): Promise<void> {
  await supabase
    .from("progress")
    .upsert(
      { user_id: userId, data: folders, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
}

// ---- ユーティリティ ----
export function calcSectionProgress(section: Section): { total: number; read: number } {
  const total = Math.max(0, section.endNum - section.startNum + 1);
  const read = Object.keys(section.statuses).filter((k) => {
    const n = parseInt(k, 10);
    return n >= section.startNum && n <= section.endNum;
  }).length;
  return { total, read };
}

export function calcWorkProgress(sections: Section[]): { total: number; read: number; percent: number } {
  let total = 0;
  let read = 0;
  for (const s of sections) {
    const p = calcSectionProgress(s);
    total += p.total;
    read += p.read;
  }
  const percent = total > 0 ? Math.round((read / total) * 100) : 0;
  return { total, read, percent };
}

export function exportData(folders: Folder[]): string {
  return JSON.stringify(folders, null, 2);
}

export function importData(json: string): Folder[] | null {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    return parsed as Folder[];
  } catch {
    return null;
  }
}

// ---- Stock（Supabase） ----
import type { StockItem } from "./types";

export async function loadStockFromCloud(userId: string): Promise<StockItem[] | null> {
  const { data, error } = await supabase
    .from("stock")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.data as StockItem[];
}

export async function saveStockToCloud(userId: string, items: StockItem[]): Promise<void> {
  await supabase
    .from("stock")
    .upsert(
      { user_id: userId, data: items, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
}

import type { VocabEntry } from "./screens/VocabScreen"; // パスは実際の配置に合わせて調整してください

export async function loadVocabFromCloud(userId: string): Promise<VocabEntry[] | null> {
  const { data, error } = await supabase
    .from("vocab")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("loadVocabFromCloud error:", error);
    return null;
  }
  if (!data) return null;
  return data.data as VocabEntry[];
}

export async function saveVocabToCloud(userId: string, entries: VocabEntry[]): Promise<void> {
  const { error } = await supabase
    .from("vocab")
    .upsert(
      {
        user_id: userId,
        data: entries,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("saveVocabToCloud error:", error);
  }
}