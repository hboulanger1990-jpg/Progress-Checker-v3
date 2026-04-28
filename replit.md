# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

### manga-tracker (React + Vite, previewPath: /)

フル機能の漫画進捗管理アプリ。バックエンドなし・localStorageのみで永続化。

**画面構成:**
- **ホーム画面**: 登録済みタイトル一覧（進捗バー・読了数/総巻数表示）、タイトル検索、並び順は更新日時降順
- **個別管理画面**: 巻数グリッド（未購入→所持黄→読了青のループ）、タイトル/最大巻数編集、一括読了ボタン、削除

**データ構造 (localStorage key: `manga-tracker-v2`):**
```typescript
interface MangaEntry {
  id: string;
  title: string;
  totalVolumes: number;
  statuses: Record<number, VolumeStatus>; // vol -> "owned"|"read" (unowned = absent)
  updatedAt: number;
}
```

**ファイル構成:**
- `src/types.ts` — 型定義
- `src/storage.ts` — localStorage読み書きヘルパー
- `src/App.tsx` — 状態管理・画面遷移（フェードトランジション）
- `src/components/HomeScreen.tsx` — ホーム画面
- `src/components/DetailScreen.tsx` — 個別管理画面
- `src/components/AddMangaModal.tsx` — 追加/編集モーダル
- `src/components/BackupModal.tsx` — JSONエクスポート/インポート
