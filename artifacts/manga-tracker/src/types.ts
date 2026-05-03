export type AccentColor = "blue" | "green" | "red" | "purple" | "yellow" | "teal";

export const ACCENT_COLORS: Record<AccentColor, { label: string; hex: string }> = {
  blue:   { label: "ブルー",    hex: "#7aa2f7" },
  green:  { label: "グリーン",  hex: "#9ece6a" },
  red:    { label: "レッド",    hex: "#f7768e" },
  purple: { label: "パープル",  hex: "#bb9af7" },
  yellow: { label: "イエロー",  hex: "#e0af68" },
  teal:   { label: "ティール",  hex: "#2ac3de" },
};

export type SortOrder =
  | "default"           // 登録順
  | "reverse"           // 登録逆順
  | "completed_first"   // 完了→未完了（完了タイプのみ）
  | "incomplete_first"  // 未完了→完了（完了タイプのみ）
  | "abc"               // あいうえお順（完了タイプ・テキストモードのみ）
  | "progress_asc"      // 進捗順 低→高（進捗タイプのみ）
  | "progress_desc";    // 進捗順 高→低（進捗タイプのみ）

export interface Section {
  id: string;
  label: string;
  startNum: number;
  endNum: number;
  statuses: Record<number, "read">;
  mode?: "number" | "text";
  items?: string[];
  sortOrder?: SortOrder;
}

export interface Work {
  id: string;
  title: string;
  accentColor: AccentColor;
  labelUnread: string;
  labelRead: string;
  unit: string;
  sectionLabel?: string;
  sections: Section[];
  tags?: string[];
  completed?: boolean;
  sortOrder?: SortOrder;
  updatedAt: number;
}

export interface Folder {
  id: string;
  title: string;
  accentColor: AccentColor;
  type?: "progress" | "read";
  defaultLabelUnread?: string;
  defaultLabelRead?: string;
  defaultUnit?: string;
  works: Work[];
  updatedAt: number;
}
