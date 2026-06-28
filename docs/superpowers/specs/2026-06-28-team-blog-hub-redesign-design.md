# Team Blog Hub — フルリニューアル & Cloudflare 移行 設計書

**作成日**: 2026-06-28
**ステータス**: Draft（実装前レビュー待ち）

## 1. 概要

Whatever Co. のチームブログ集約サイト（team-blog-hub）を、デザインと技術スタックの両面でフルリニューアルし、デプロイ先を Vercel から Cloudflare に移す。GitHub Actions による旧 cron 再ビルド方式は廃止し、Cloudflare 完結のスケジュール再生成に置き換える。

## 2. ゴール / 非ゴール

### ゴール

- 古い Next.js 12 / React 17 / SCSS 構成を、Next.js 15 / React 19 / TypeScript / Tailwind CSS v4 に刷新する
- 「エディトリアル・モノ」方向のミニマルな新デザインに置き換える（serif × monospace、白基調）
- Cloudflare Workers（Static Assets binding）でホスティングする
- 日次の RSS 取り込み & 再デプロイを Cloudflare 完結で自動化する（GitHub Actions を使わない）
- RSS 2.0 / Atom の集約フィードを配信する

### 非ゴール

- 検索・タグ・カテゴリ・フィルタ高度化（アバター帯クリックの単純フィルタのみ）
- ダークモード対応
- OG 画像の動的生成
- 動的レンダリング（SSR / ISR）— サイトは 100% 静的
- 既存 URL の互換維持（`/` `/about` `/members` `/members/[id]` は維持、それ以外は新規）
- 管理画面・編集 UI

## 3. アーキテクチャ

```
GitHub repo (main)
   │  push
   ▼
Cloudflare Workers Builds  ────────────────────────┐
   │  pnpm install && pnpm build                   │
   │  ├─ scripts/build-posts.ts   (RSS → posts.json)│
   │  ├─ scripts/build-feeds.ts   (RSS / Atom 生成) │
   │  └─ next build (output: 'export')             │
   ▼                                               │
out/  (Static Assets)                              │
   │  wrangler deploy                              │
   ▼                                               │
Cloudflare Worker  ──────────────────────────────┐ │
   ├─ Static Assets binding  (HTML/CSS/JS/JPG)   │ │
   ├─ /feed.xml, /feed.atom  (静的ファイル)       │ │
   └─ scheduled handler (cron)  ──── fetch ──────┘ │
        毎日 02:00 JST                              │
        Workers Builds Deploy Hook を叩いて再ビルド  │
                                                   │
                                                   ▼
                                       再ビルド & 再デプロイ
```

### 主要コンポーネント

| コンポーネント | 役割 |
|---|---|
| `members.ts` | メンバーと RSS ソースの定義（現状を踏襲） |
| `scripts/build-posts.ts` | ビルド時に全メンバーの RSS を取得して `.contents/posts.json` を生成 |
| `scripts/build-feeds.ts` | `.contents/posts.json` から `public/feed.xml` `public/feed.atom` を生成 |
| Next.js App Router | `/`, `/members`, `/members/[id]`, `/about`, `/404` を静的生成 |
| Tailwind CSS v4 | デザインシステム実装 |
| Cloudflare Worker | Static Assets 配信 + scheduled handler |
| Cron Trigger | 日次で Deploy Hook を fetch |

## 4. ページ構成

| ルート | 内容 | 生成方法 |
|---|---|---|
| `/` | ヒーロー（"Engineering log." セリフ斜体）+ メンバーアバター帯 + 記事全件リスト | SSG |
| `/members/` | メンバーカード一覧 | SSG |
| `/members/[id]` | プロフィールヘッダ（アバター・名前・ロール・bio・SNS リンク）+ そのメンバーの記事一覧 | SSG（generateStaticParams） |
| `/about` | About テキスト + back link | SSG |
| `/404` | Not Found | SSG |
| `/feed.xml` | RSS 2.0 集約フィード | ビルド時生成（public/） |
| `/feed.atom` | Atom 集約フィード | ビルド時生成（public/） |
| `/robots.txt` | クローラ制御 | public/ 静的 |
| `/sitemap.xml` | サイトマップ | ビルド時生成（next-sitemap または独自スクリプト） |

## 5. デザインシステム

### 5.1 トーン

「エディトリアル・モノ」— serif と monospace の組み合わせ。technical & literate。余白多め。色はほぼ白黒で、罫線とタイポグラフィで階層を作る。

### 5.2 カラーパレット

| トークン | 値 | 用途 |
|---|---|---|
| `--bg` | `#fafafa` | ページ背景 |
| `--surface` | `#ffffff` | カード背景（必要なとき） |
| `--text` | `#111111` | 主要テキスト |
| `--text-muted` | `#666666` | 副次テキスト |
| `--text-dim` | `#999999` | 日付・出典など最弱情報 |
| `--rule-solid` | `#111111` | セクション区切りの実線 |
| `--rule-dashed` | `#dddddd` | 行間の点線 |
| `--rule-soft` | `#eeeeee` | ヘッダ下の薄罫 |
| `--accent` | `#111111` | リンク下線（黒 underline） |
| `--hover` | `#f0f0f0` | 行 hover 背景 |

アクセントカラー（青や赤）は使わない。リンクは黒下線、hover で背景を薄グレーに。

### 5.3 タイポグラフィ

| 用途 | フォント | サイズ |
|---|---|---|
| ヒーロー H1（"Engineering log."） | serif italic（Source Serif 4 / Crimson Pro / 候補は実装フェーズで決定） | 48–56 px |
| 記事タイトル（行内） | serif（同上、roman） | 16–17 px |
| メタ情報（日付・出典・author） | monospace（JetBrains Mono / IBM Plex Mono） | 10–13 px |
| 本文（about など） | system sans（`-apple-system, BlinkMacSystemFont, "Segoe UI"`） | 14–16 px |
| ナビ・ラベル | monospace, UPPERCASE, letter-spacing 0.1em | 10–11 px |

フォントは Google Fonts もしくは self-host で配信。具体的な選定は実装フェーズで（Source Serif 4 + JetBrains Mono が第一候補）。

### 5.4 主要レイアウト要素

#### ヘッダ
- 左: `WHATEVER/DEV-BLOG`（monospace, uppercase, letter-spacing）→ `/` リンク
- 右: ナビ `ABOUT / MEMBERS / RSS`（monospace, uppercase）
  - `ABOUT` → `/about`
  - `MEMBERS` → `/members/`
  - `RSS` → `/feed.xml`（新規タブ）
- 下に 1px 薄罫

#### ヒーロー
- H1: `Engineering log.`（serif italic, 48–56 px）
- サブ: `By the engineers at Whatever Co. — N members, ∞ posts.`（monospace 12 px, text-muted）

#### アバター帯（トップのみ）
- 左に `MEMBERS` ラベル（monospace, uppercase）
- 全メンバーのアバター（44 × 44 px 円、grayscale 100%）
- hover で `filter: none` + 軽い scale
- クリックで「そのメンバーで一覧フィルタ」（後述）
- 下に 1px 黒実線

#### 記事行
```
[ date  ] [ ◯ ] [ Title (serif)         ] [ author    ]
            avatar  source (mono)
  92px      52px    1fr                     110px
```
- 行の下に 1px 点線
- hover で行背景が `#f0f0f0`
- 行クリックで記事 URL に遷移（target="_blank" rel="noopener"）

### 5.5 フィルタ機能

- アバター帯のメンバーをクリックすると、その人の記事だけ残る
- 選択中のアバターは枠線で示し、それ以外は dim 表示
- 同じメンバーを再クリックで解除
- URL は `?author=<id>` で表現（リロード後も状態保持、共有可能）
- クライアントサイドの React state + URLSearchParams で実装、SSR は前提にしない

## 6. データフロー

### 6.1 ビルド時

1. `pnpm build` → `prebuild` → `scripts/build-posts.ts` 実行
2. `members.ts` の全メンバーの `sources` を逐次 fetch
3. `rss-parser` でパースし `PostItem[]` に正規化
4. `includeUrlRegex` / `excludeUrlRegex` を適用
5. 日付降順ソートし `.contents/posts.json` に保存
6. `scripts/build-feeds.ts` 実行 → `public/feed.xml` / `public/feed.atom` 生成
7. `next build` 実行 → `out/` に静的サイト生成（`output: 'export'`）
8. `wrangler deploy` で `out/` を Cloudflare Workers Static Assets にデプロイ

### 6.2 データ型

`src/types.ts` は既存の `Member` / `PostItem` をベースに、出典サイト（`sourceHost`）を追加:

```ts
export type Member = {
  id: string;
  name: string;
  avatarSrc: string;
  role?: string;
  bio?: string;
  sources?: string[];
  includeUrlRegex?: string;
  excludeUrlRegex?: string;
  githubUsername?: string;
  twitterUsername?: string;
  websiteUrl?: string;
};

export type PostItem = {
  authorId: string;
  authorName: string;
  title: string;
  link: string;
  contentSnippet?: string;
  isoDate?: string;
  dateMiliSeconds: number;
  sourceHost: string;  // 新規: "zenn.dev" / "qiita.com" / "note.com" など、行の出典表示用
};
```

## 7. Cron / 再ビルド戦略

### 7.1 仕組み

Cloudflare Workers の `[triggers.crons]` で scheduled handler を 1 日 1 回（02:00 JST = 17:00 UTC）に発火。handler は環境変数 `BUILD_HOOK_URL` に `fetch` するだけ。

```ts
// src/worker/index.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    await fetch(env.BUILD_HOOK_URL, { method: "POST" });
  },
  // Static Assets は wrangler.toml の assets binding で配信されるため fetch ハンドラは不要
} satisfies ExportedHandler<Env>;
```

### 7.2 設定

- `wrangler.toml`:
  - `[assets]` で `out/` を binding
  - `[triggers]` で `crons = ["0 17 * * *"]`
  - `[vars]` には機密でないものだけ、`BUILD_HOOK_URL` は `wrangler secret put` で投入
- Cloudflare Workers Builds 側で Deploy Hook を作成し、その URL を `BUILD_HOOK_URL` として登録
- `BUILD_HOOK_URL` 漏洩防止のため、コミットしない（`.dev.vars` も `.gitignore` 入り）

### 7.3 リトライ

Cron handler 1 回の fetch 失敗時のリカバリは初期実装には入れない（Workers Builds 側のビルドエラーや Deploy Hook 500 系は次の日に解消想定）。必要になれば 2 回まで指数バックオフリトライを追加する。

## 8. デプロイ

### 8.1 ローカル開発

```bash
pnpm install
pnpm build:posts   # RSS 取得（初回 & 必要時）
pnpm dev           # Next.js dev server
```

### 8.2 本番デプロイ

通常は `git push origin main` のみで Workers Builds が自動ビルド & デプロイ。手動で叩きたい場合は:

```bash
pnpm build
pnpm wrangler deploy
```

### 8.3 環境変数 / シークレット

| 変数 | 種別 | 用途 |
|---|---|---|
| `BUILD_HOOK_URL` | secret | Cron handler が叩く Workers Builds の Deploy Hook URL |
| `SITE_ORIGIN` | var | 本番 origin（`https://dev-blog.whatever.co` 等、未確定） |

`SITE_ORIGIN` はビルド時にも参照する（feed.xml の絶対 URL、sitemap など）。Workers Builds の環境変数で渡す。

### 8.4 ドメイン

最終ドメインは未確定（候補: `dev-blog.whatever.co`）。初期は `team-blog-hub.<workers-subdomain>.workers.dev` で動作確認し、確定後に Custom Domain を割り当てる。

## 9. 既存コードからの移行方針

| 既存 | 新 | 扱い |
|---|---|---|
| `src/pages/*.tsx`（Pages Router） | `src/app/**/page.tsx`（App Router） | 全置換 |
| `src/components/*.tsx`（SiteHeader, PostList 等） | 新コンポーネント（`Header`, `PostRow`, `MemberBelt`, `Hero` 等） | 全置換 |
| `src/styles/**/*.scss` | Tailwind v4 + 最小 `app/globals.css` | 全削除 |
| `src/builder/posts.ts` | `scripts/build-posts.ts` | ロジック踏襲、型に `sourceHost` 追加 |
| `members.ts` | `members.ts`（同位置） | 維持（型のみ拡張） |
| `site.config.ts` | `site.config.ts`（同位置） | 維持、`siteRoot` を新 origin に更新 |
| `next.config.js` | `next.config.ts`（`output: 'export'` を含む） | 新規 |
| `wrangler.toml` | 新規 | 新規 |
| `.vercel/` | 削除 | Vercel 連携は完全に切る |

## 10. リスク / 未確定事項

| 項目 | リスク / メモ |
|---|---|
| Next.js 15 の `output: 'export'` + 動的ルート | `/members/[id]` は `generateStaticParams` で全 ID 列挙すれば export 可能。`dynamic = 'force-static'` 指定要。 |
| App Router での `useSearchParams` | `?author=<id>` の読み取りは client component + suspense boundary が必要（`<Suspense>` で囲まないと build エラー）。トップの記事一覧コンポーネントを Client Component 化する。 |
| Tailwind v4 と Next.js 15 | v4 は CSS-first 設定。`@theme` でデザイントークンを定義。導入手順を実装フェーズで確認。 |
| Workers Builds の Deploy Hook | Cloudflare ダッシュボードでの設定手順を実装フェーズで確認・記録する。 |
| Cron Trigger と Static Assets binding の共存 | 同一 Worker で `[assets]` + `[triggers.crons]` + `scheduled` handler が動くことを早期に検証する。 |
| 既存アバター画像 | `public/avatars/*.jpg` をそのまま流用。Next.js Image は static export と組み合わせるとき制約があるため、通常の `<img>` を使う。 |
| カスタムドメイン | `dev-blog.whatever.co` を想定するが、確定までは Workers サブドメインで稼働。 |
| 旧 `whatever-dev-blog.vercel.app` URL | 旧 URL からの遷移は当面 Vercel 側で 301 を仕掛ける／放置のいずれか。本リニューアルのスコープ外として明示。 |
| RSS 取得失敗 | あるメンバーの 1 つのフィードが落ちていてもビルド失敗にしない（既存挙動踏襲）。fetch エラーはログに残してそのソースだけスキップ。 |

## 11. 成功基準

- 新サイトが本番ドメインで Lighthouse Performance / Accessibility / Best Practices / SEO すべて 95 以上
- `git push` だけで自動デプロイされ、手動操作不要
- Cron Trigger が 7 日連続で発火し、毎日 posts.json が更新されていることを確認
- RSS / Atom フィードが妥当性検証ツール（W3C Feed Validator）に通る
- 既存 8 メンバー全員のアバター・記事が新トップに表示される
