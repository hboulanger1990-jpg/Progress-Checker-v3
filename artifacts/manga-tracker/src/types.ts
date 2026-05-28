export type AccentColor = "blue" | "green" | "red" | "purple" | "yellow" | "teal";

export const ACCENT_COLORS: Record<AccentColor, { label: string; hex: string; bgSepia: string }> = {
  blue:   { label: "ブルー",    hex: "#7aa2f7", bgSepia: "#c5ddf5" },
  green:  { label: "グリーン",  hex: "#9ece6a", bgSepia: "#c6e1be" },
  red:    { label: "レッド",    hex: "#f7768e", bgSepia: "#f5cec1" },
  purple: { label: "パープル",  hex: "#bb9af7", bgSepia: "#d0c2f3" },
  yellow: { label: "イエロー",  hex: "#e0af68", bgSepia: "#f8d3ad" },
  teal:   { label: "ティール",  hex: "#2ac3de", bgSepia: "#b8e0d8" },
};

export type FolderPattern =
  | "none"
  | "books"
  | "progress"
  | "bubbles"
  | "screen"
  | "ebook"
  | "openbook"
  | "stars"
  | "chevron"
  | "jigsaw"
  | "hexagon";

export const FOLDER_PATTERNS: Record<FolderPattern, { label: string }> = {
  none:      { label: "なし" },
  books:     { label: "本棚" },
  progress:  { label: "進捗バー" },
  bubbles:   { label: "吹き出し" },
  screen:    { label: "画面" },
  ebook:     { label: "タブレット" },
  openbook:  { label: "見開き" },
  stars:     { label: "スター" },
  chevron:   { label: "シェブロン" },
  jigsaw:   { label: "ジグソー" },
  hexagon:   { label: "ヘキサゴン" },
};

export type SortOrder =
  | "default"
  | "reverse"
  | "completed_first"
  | "incomplete_first"
  | "abc"
  | "progress_asc"
  | "progress_desc";

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
  pattern?: FolderPattern;
  defaultLabelUnread?: string;
  defaultLabelRead?: string;
  defaultUnit?: string;
  itemSize?: "1" | "2" | "full";
  works: Work[];
  updatedAt: number;
}
