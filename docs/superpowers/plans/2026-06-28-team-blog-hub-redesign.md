# Team Blog Hub Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Whatever Co. のチームブログ集約サイトを Next.js 15 / React 19 / Tailwind v4 でフルリニューアルし、Cloudflare Workers (Static Assets) + Cron Trigger ベースのデプロイに移行する。

**Architecture:** `output: 'export'` による 100% 静的サイト。ビルド時に RSS を取得して posts.json と RSS/Atom フィードを生成。Cloudflare Workers が Static Assets を配信し、scheduled handler が日次で Workers Builds Deploy Hook を叩いて再ビルドする。

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS v4, pnpm, rss-parser, feed (RSS/Atom 生成), Vitest, Cloudflare Workers + Wrangler.

**Spec:** [docs/superpowers/specs/2026-06-28-team-blog-hub-redesign-design.md](../specs/2026-06-28-team-blog-hub-redesign-design.md)

## Global Constraints

- Node.js: 22 LTS 以上（Cloudflare Workers Builds は 24 LTS デフォルト）
- パッケージマネージャ: pnpm 9+（`packageManager` フィールドで固定）
- Next.js: 15.x、App Router 専用、`output: 'export'`
- React: 19.x
- TypeScript: 5.x、`strict: true`
- Tailwind CSS: v4（CSS-first 設定、`@theme` トークン）
- 静的サイト前提：`use server` 不可、`getServerSideProps`/`ISR` 不可、画像は素の `<img>`
- ライトモード一本（`prefers-color-scheme: dark` 対応なし）
- リンクは `target="_blank" rel="noopener noreferrer"`（外部記事）
- コミットメッセージ: 英語、imperative mood、Co-Authored-By 行付き
- 既存ブランチ `feat/redesign-cloudflare-migration` で作業

---

## ファイル構造（最終形）

```
team-blog-hub/
├─ members.ts                            # 維持（型のみ拡張なし）
├─ site.config.ts                        # 維持、siteRoot を新 origin に更新
├─ package.json                          # 全置換
├─ pnpm-lock.yaml                        # 新規
├─ tsconfig.json                         # 全置換
├─ next.config.ts                        # 新規（output: 'export'）
├─ postcss.config.mjs                    # 新規（Tailwind v4）
├─ wrangler.toml                         # 新規
├─ vitest.config.ts                      # 新規
├─ .gitignore                            # 既に更新済み
├─ README.md                             # 全置換
├─ public/
│  ├─ avatars/*.jpg                      # 維持
│  ├─ favicon.ico                        # 維持
│  ├─ feed.xml                           # ビルド時生成
│  └─ feed.atom                          # ビルド時生成
├─ scripts/
│  ├─ build-posts.ts                     # 旧 src/builder/posts.ts のロジック踏襲
│  └─ build-feeds.ts                     # 新規
├─ src/
│  ├─ types.ts                           # 全置換（sourceHost 追加）
│  ├─ lib/
│  │  ├─ posts.ts                        # 新規：posts.json 読み込み
│  │  └─ members.ts                      # 新規：members helper
│  ├─ app/
│  │  ├─ layout.tsx                      # 新規
│  │  ├─ page.tsx                        # 新規（トップ）
│  │  ├─ globals.css                     # 新規（Tailwind v4 + @theme）
│  │  ├─ not-found.tsx                   # 新規
│  │  ├─ sitemap.ts                      # 新規
│  │  ├─ robots.ts                       # 新規
│  │  ├─ about/page.tsx                  # 新規
│  │  └─ members/
│  │     ├─ page.tsx                     # 新規（一覧）
│  │     └─ [id]/page.tsx                # 新規（詳細）
│  ├─ components/
│  │  ├─ Header.tsx                      # 新規
│  │  ├─ Hero.tsx                        # 新規
│  │  ├─ MemberBelt.tsx                  # 新規
│  │  ├─ PostList.tsx                    # 新規（client、フィルタ）
│  │  ├─ PostRow.tsx                     # 新規
│  │  ├─ MemberCard.tsx                  # 新規
│  │  └─ MemberProfileHeader.tsx         # 新規
│  └─ worker/
│     └─ index.ts                        # 新規（scheduled handler）
└─ tests/
   ├─ build-posts.test.ts                # 新規
   └─ build-feeds.test.ts                # 新規
```

削除：`.next/`, `.vercel/`, `next-env.d.ts`, `tsconfig.builder.json`, `yarn.lock`, `src/pages/`, `src/components/`（旧）, `src/styles/`, `src/builder/`, `src/utils/`, `.eslintrc.json`, `.contents/`（再生成）。

---

## Task 1: Bootstrap — 旧コード掃除と新スタック初期化

**Files:**
- Delete: `.next/`, `.vercel/`, `next-env.d.ts`, `tsconfig.builder.json`, `yarn.lock`, `src/pages/`, `src/components/`, `src/styles/`, `src/builder/`, `src/utils/`, `.eslintrc.json`, `.contents/`
- Modify: `package.json`（全置換）, `tsconfig.json`（全置換）
- Create: `next.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`（最小）, `src/app/page.tsx`（最小）, `src/app/globals.css`（空）

**Interfaces:**
- Produces: 新 `package.json` の `scripts` (`dev`, `build`, `build:posts`, `build:feeds`, `lint`, `test`, `deploy`), `pnpm-lock.yaml`, App Router の最小構成

- [ ] **Step 1: 旧ファイル削除**

```bash
rm -rf .next .vercel next-env.d.ts tsconfig.builder.json yarn.lock \
  src/pages src/components src/styles src/builder src/utils \
  .eslintrc.json .contents
```

- [ ] **Step 2: 新 `package.json` を書く（全置換）**

```json
{
  "name": "team-blog-hub",
  "version": "1.0.0",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "next dev",
    "prebuild": "pnpm build:posts && pnpm build:feeds",
    "build": "next build",
    "build:posts": "tsx scripts/build-posts.ts",
    "build:feeds": "tsx scripts/build-feeds.ts",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "deploy": "pnpm build && wrangler deploy"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-icons": "^5.4.0",
    "dayjs": "^1.11.13"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250101.0",
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.17.0",
    "eslint-config-next": "^15.1.0",
    "feed": "^4.2.2",
    "fs-extra": "^11.2.0",
    "@types/fs-extra": "^11.0.4",
    "postcss": "^8.4.49",
    "rss-parser": "^3.13.0",
    "tailwindcss": "^4.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.8",
    "wrangler": "^3.99.0"
  }
}
```

- [ ] **Step 3: `tsconfig.json` 書く**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "types": ["@cloudflare/workers-types"],
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@site.config": ["./site.config.ts"],
      "@members": ["./members.ts"],
      "@contents/*": ["./.contents/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "out", "src/worker"]
}
```

- [ ] **Step 4: `next.config.ts` 書く**

```ts
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
};

export default config;
```

- [ ] **Step 5: `postcss.config.mjs` 書く**

```js
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
```

- [ ] **Step 6: 最小 App Router を作る**

`src/app/globals.css`:
```css
@import "tailwindcss";
```

`src/app/layout.tsx`:
```tsx
import "./globals.css";
import type { Metadata } from "next";
import { config } from "@site.config";

export const metadata: Metadata = {
  title: config.siteMeta.title,
  description: config.siteMeta.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
export default function Page() {
  return <main>boot ok</main>;
}
```

- [ ] **Step 7: `pnpm install` & dev 起動確認**

Run: `pnpm install && pnpm dev`
Expected: `http://localhost:3000` で "boot ok" が表示される。Ctrl+C で停止。

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Bootstrap: Next.js 15 + React 19 + Tailwind v4 + pnpm

- Remove legacy Next 12 / React 17 / SCSS / Vercel artifacts
- Add new package.json with Next 15, React 19, Tailwind v4, pnpm, wrangler, vitest
- Add tsconfig.json with strict mode and path aliases
- Add next.config.ts with output: 'export'
- Add minimal App Router scaffolding (layout, page, globals.css)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Tailwind v4 デザイントークン

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: CSS custom properties via `@theme`：色トークン (`--color-bg`, `--color-text`, `--color-text-muted`, `--color-text-dim`, `--color-rule-solid`, `--color-rule-dashed`, `--color-rule-soft`, `--color-hover`)、フォントトークン (`--font-serif`, `--font-mono`, `--font-sans`)

- [ ] **Step 1: `src/app/globals.css` 書き換え**

```css
@import "tailwindcss";

@theme {
  --color-bg: #fafafa;
  --color-surface: #ffffff;
  --color-text: #111111;
  --color-text-muted: #666666;
  --color-text-dim: #999999;
  --color-rule-solid: #111111;
  --color-rule-dashed: #dddddd;
  --color-rule-soft: #eeeeee;
  --color-hover: #f0f0f0;

  --font-serif: "Source Serif 4", Georgia, "Times New Roman", serif;
  --font-mono: "JetBrains Mono", "SF Mono", Menlo, monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

html, body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; text-decoration: none; }
```

- [ ] **Step 2: フォント Google Fonts 経由読み込みを `layout.tsx` に追加**

`src/app/layout.tsx` の `<head>` に `next/font` を使う:

```tsx
import { Source_Serif_4, JetBrains_Mono } from "next/font/google";

const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

// <body className={`${serif.variable} ${mono.variable}`}>
```

- [ ] **Step 3: 動作確認**

Run: `pnpm dev`
Expected: ブラウザで body 背景が `#fafafa`、テキスト色が `#111111`、フォントが system sans。DevTools で `--color-bg` が解決されていること。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "Add Tailwind v4 design tokens (colors, fonts)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 型定義 & データ読み込みレイヤ

**Files:**
- Create: `src/types.ts`, `src/lib/posts.ts`, `src/lib/members.ts`

**Interfaces:**
- Produces:
  - `type Member` (from `src/types.ts`)
  - `type PostItem` with `sourceHost: string` (from `src/types.ts`)
  - `function getAllPosts(): PostItem[]` (from `src/lib/posts.ts`)
  - `function getPostsByAuthor(id: string): PostItem[]` (from `src/lib/posts.ts`)
  - `function getMember(id: string): Member | undefined` (from `src/lib/members.ts`)
  - `function getAllMembers(): Member[]` (from `src/lib/members.ts`)

- [ ] **Step 1: `src/types.ts` 書く**

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
  sourceHost: string;
};
```

- [ ] **Step 2: `src/lib/posts.ts` 書く**

```ts
import postsJson from "@contents/posts.json";
import type { PostItem } from "@/types";

export function getAllPosts(): PostItem[] {
  return postsJson as PostItem[];
}

export function getPostsByAuthor(id: string): PostItem[] {
  return getAllPosts().filter((p) => p.authorId === id);
}
```

- [ ] **Step 3: `src/lib/members.ts` 書く**

```ts
import { members } from "@members";
import type { Member } from "@/types";

export function getAllMembers(): Member[] {
  return members;
}

export function getMember(id: string): Member | undefined {
  return members.find((m) => m.id === id);
}
```

- [ ] **Step 4: 空の `.contents/posts.json` を作る（次タスクで上書き）**

```bash
mkdir -p .contents && echo '[]' > .contents/posts.json
```

- [ ] **Step 5: 型チェック**

Run: `pnpm exec tsc --noEmit`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "Add types and data layer (lib/posts, lib/members)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: build-posts スクリプト

**Files:**
- Create: `scripts/build-posts.ts`, `tests/build-posts.test.ts`, `vitest.config.ts`

**Interfaces:**
- Consumes: `Member`, `PostItem` (from `src/types.ts`), `members` (from `members.ts`)
- Produces: `.contents/posts.json` ファイル（ビルド時生成、`PostItem[]` 形式、日付降順ソート、`sourceHost` 付き）

- [ ] **Step 1: `vitest.config.ts` 書く**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@members": path.resolve(__dirname, "./members.ts"),
      "@site.config": path.resolve(__dirname, "./site.config.ts"),
    },
  },
});
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/build-posts.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeFeedItem, extractSourceHost } from "../scripts/build-posts";

describe("extractSourceHost", () => {
  it("returns hostname without www", () => {
    expect(extractSourceHost("https://zenn.dev/foo/articles/bar")).toBe("zenn.dev");
    expect(extractSourceHost("https://www.qiita.com/x")).toBe("qiita.com");
    expect(extractSourceHost("not a url")).toBe("");
  });
});

describe("normalizeFeedItem", () => {
  it("returns null when title or link missing", () => {
    expect(normalizeFeedItem({ title: "", link: "https://x.com" }, "alice", "Alice")).toBeNull();
    expect(normalizeFeedItem({ title: "Hi", link: "" }, "alice", "Alice")).toBeNull();
  });

  it("returns null for non-http(s) links", () => {
    expect(normalizeFeedItem({ title: "Hi", link: "javascript:alert(1)" }, "alice", "Alice")).toBeNull();
  });

  it("returns normalized PostItem with sourceHost", () => {
    const result = normalizeFeedItem(
      { title: "Hello", link: "https://zenn.dev/a/articles/b", isoDate: "2026-01-15T00:00:00Z", contentSnippet: "x\ny" },
      "alice",
      "Alice"
    );
    expect(result).toEqual({
      authorId: "alice",
      authorName: "Alice",
      title: "Hello",
      link: "https://zenn.dev/a/articles/b",
      isoDate: "2026-01-15T00:00:00Z",
      dateMiliSeconds: new Date("2026-01-15T00:00:00Z").getTime(),
      contentSnippet: "xy",
      sourceHost: "zenn.dev",
    });
  });
});
```

- [ ] **Step 3: テスト実行で失敗確認**

Run: `pnpm test`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 4: `scripts/build-posts.ts` 実装**

```ts
import fs from "fs-extra";
import Parser from "rss-parser";
import path from "node:path";
import { members } from "../members";
import type { PostItem, Member } from "../src/types";

export function extractSourceHost(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

type RawItem = { title?: string; link?: string; contentSnippet?: string; isoDate?: string };

export function normalizeFeedItem(
  raw: RawItem,
  authorId: string,
  authorName: string
): PostItem | null {
  const { title, link, contentSnippet, isoDate } = raw;
  if (!title || !link) return null;
  let parsed: URL;
  try { parsed = new URL(link); } catch { return null; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return {
    authorId,
    authorName,
    title,
    link,
    isoDate,
    dateMiliSeconds: isoDate ? new Date(isoDate).getTime() : 0,
    contentSnippet: contentSnippet?.replace(/\n/g, ""),
    sourceHost: extractSourceHost(link),
  };
}

async function fetchMember(member: Member, parser: Parser): Promise<PostItem[]> {
  if (!member.sources?.length) return [];
  const items: PostItem[] = [];
  for (const url of member.sources) {
    try {
      const feed = await parser.parseURL(url);
      for (const raw of feed.items ?? []) {
        const norm = normalizeFeedItem(raw, member.id, member.name);
        if (norm) items.push(norm);
      }
    } catch (err) {
      console.warn(`[build-posts] failed to fetch ${url}:`, (err as Error).message);
    }
  }
  return items
    .filter((p) => !member.includeUrlRegex || new RegExp(member.includeUrlRegex).test(p.link))
    .filter((p) => !member.excludeUrlRegex || !new RegExp(member.excludeUrlRegex).test(p.link));
}

async function main() {
  const parser = new Parser();
  const all: PostItem[] = [];
  for (const member of members) {
    const items = await fetchMember(member, parser);
    all.push(...items);
  }
  all.sort((a, b) => b.dateMiliSeconds - a.dateMiliSeconds);
  const outPath = path.resolve(".contents/posts.json");
  fs.ensureDirSync(path.dirname(outPath));
  fs.writeJsonSync(outPath, all, { spaces: 2 });
  console.log(`[build-posts] wrote ${all.length} posts to ${outPath}`);
}

if (process.argv[1] && process.argv[1].endsWith("build-posts.ts")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 5: テスト実行で成功確認**

Run: `pnpm test`
Expected: PASS（4 tests）

- [ ] **Step 6: 実 RSS 取得を試す**

Run: `pnpm build:posts`
Expected: `.contents/posts.json` に数十〜数百件の `PostItem` が書かれる。一部 RSS が落ちていてもプロセスは exit 0。

- [ ] **Step 7: コミット**

```bash
git add -A
git commit -m "Add build-posts script with RSS aggregation and unit tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: build-feeds スクリプト（RSS 2.0 + Atom）

**Files:**
- Create: `scripts/build-feeds.ts`, `tests/build-feeds.test.ts`
- Modify: `site.config.ts`（`siteRoot` を Cloudflare のドメインに更新、ただし暫定で `https://team-blog-hub.workers.dev` で OK）

**Interfaces:**
- Consumes: `.contents/posts.json`, `site.config.ts` の `siteRoot`
- Produces: `public/feed.xml`（RSS 2.0）, `public/feed.atom`（Atom 1.0）, 関数 `buildFeed(posts, siteRoot, type): string`

- [ ] **Step 1: `site.config.ts` の siteRoot を Cloudflare 用に更新**

```ts
export const config = {
  siteMeta: {
    title: "Whatever Dev Blog",
    teamName: "Whatever Co.",
    description: "Whatever Co. Dev Team Blog",
  },
  siteRoot:
    process.env.NODE_ENV === "production"
      ? "https://team-blog-hub.workers.dev"
      : "http://localhost:3000",
  headerLinks: [
    { title: "About", href: "/about" },
    { title: "Members", href: "/members" },
    { title: "RSS", href: "/feed.xml" },
  ],
};
```

- [ ] **Step 2: 失敗テスト書く**

`tests/build-feeds.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildFeed } from "../scripts/build-feeds";
import type { PostItem } from "../src/types";

const SAMPLE: PostItem[] = [
  {
    authorId: "alice", authorName: "Alice",
    title: "Hello", link: "https://zenn.dev/a/articles/b",
    isoDate: "2026-01-15T00:00:00Z",
    dateMiliSeconds: new Date("2026-01-15T00:00:00Z").getTime(),
    sourceHost: "zenn.dev",
  },
];

describe("buildFeed", () => {
  it("emits valid RSS 2.0 XML with item", () => {
    const xml = buildFeed(SAMPLE, "https://example.com", "rss2");
    expect(xml).toContain("<rss");
    expect(xml).toContain("<title>Hello</title>");
    expect(xml).toContain("<link>https://zenn.dev/a/articles/b</link>");
    expect(xml).toContain("Alice");
  });

  it("emits valid Atom XML with entry", () => {
    const xml = buildFeed(SAMPLE, "https://example.com", "atom1");
    expect(xml).toContain("<feed");
    expect(xml).toContain("<entry>");
    expect(xml).toContain("<title>Hello</title>");
  });
});
```

- [ ] **Step 3: テスト失敗確認**

Run: `pnpm test`
Expected: FAIL（モジュール無し）

- [ ] **Step 4: `scripts/build-feeds.ts` 実装**

```ts
import { Feed } from "feed";
import fs from "fs-extra";
import path from "node:path";
import { config } from "../site.config";
import type { PostItem } from "../src/types";

export function buildFeed(
  posts: PostItem[],
  siteRoot: string,
  type: "rss2" | "atom1"
): string {
  const feed = new Feed({
    title: config.siteMeta.title,
    description: config.siteMeta.description,
    id: siteRoot,
    link: siteRoot,
    language: "ja",
    copyright: `© ${config.siteMeta.teamName}`,
    updated: new Date(posts[0]?.dateMiliSeconds ?? Date.now()),
  });

  for (const p of posts) {
    feed.addItem({
      title: p.title,
      id: p.link,
      link: p.link,
      description: p.contentSnippet,
      date: new Date(p.dateMiliSeconds),
      author: [{ name: p.authorName, link: `${siteRoot}/members/${p.authorId}` }],
    });
  }

  return type === "rss2" ? feed.rss2() : feed.atom1();
}

async function main() {
  const postsPath = path.resolve(".contents/posts.json");
  const posts: PostItem[] = await fs.readJson(postsPath);
  const siteRoot = config.siteRoot;
  await fs.outputFile(path.resolve("public/feed.xml"), buildFeed(posts, siteRoot, "rss2"));
  await fs.outputFile(path.resolve("public/feed.atom"), buildFeed(posts, siteRoot, "atom1"));
  console.log(`[build-feeds] wrote feed.xml and feed.atom with ${posts.length} posts`);
}

if (process.argv[1] && process.argv[1].endsWith("build-feeds.ts")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 5: テスト成功確認 + 実行**

Run: `pnpm test`
Expected: PASS（全テスト）

Run: `pnpm build:feeds`
Expected: `public/feed.xml` と `public/feed.atom` が生成される。

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "Add build-feeds script generating RSS 2.0 and Atom 1.0

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 共通レイアウト + Header コンポーネント

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/Header.tsx`

**Interfaces:**
- Produces: `<Header />` コンポーネント（ナビ + ロゴ、新規タブで RSS）

- [ ] **Step 1: `src/components/Header.tsx` 書く**

```tsx
import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-[color:var(--color-rule-soft)]">
      <div className="mx-auto max-w-[920px] px-8 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
        >
          WHATEVER/DEV-BLOG
        </Link>
        <nav className="flex gap-5 font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
          <Link href="/about" className="hover:text-[color:var(--color-text)]">About</Link>
          <Link href="/members" className="hover:text-[color:var(--color-text)]">Members</Link>
          <a
            href="/feed.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[color:var(--color-text)]"
          >
            RSS
          </a>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: `src/app/layout.tsx` を更新して Header を含む**

```tsx
import "./globals.css";
import type { Metadata } from "next";
import { Source_Serif_4, JetBrains_Mono } from "next/font/google";
import { config } from "@site.config";
import { Header } from "@/components/Header";

const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif-loaded" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-loaded" });

export const metadata: Metadata = {
  metadataBase: new URL(config.siteRoot),
  title: { default: config.siteMeta.title, template: `%s — ${config.siteMeta.title}` },
  description: config.siteMeta.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${serif.variable} ${mono.variable}`}>
      <body>
        <Header />
        <main className="mx-auto max-w-[920px] px-8">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: dev 起動確認**

Run: `pnpm dev`
Expected: ヘッダが上部に出る。ロゴ・ナビが monospace + uppercase で表示。`/about` リンクは 404 だが OK。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "Add Header component and layout with font loading

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: トップページの Hero + MemberBelt

**Files:**
- Create: `src/components/Hero.tsx`, `src/components/MemberBelt.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `getAllMembers()`, `getAllPosts()`
- Produces:
  - `<Hero memberCount={number} postCount={number} />`
  - `<MemberBelt members={Member[]} />`（リンクなし、表示のみ。フィルタは Task 8）

- [ ] **Step 1: `src/components/Hero.tsx` 書く**

```tsx
export function Hero({ memberCount, postCount }: { memberCount: number; postCount: number }) {
  return (
    <section className="pt-16 pb-2">
      <h1 className="font-serif italic text-5xl font-normal tracking-[-0.01em]">
        Engineering log.
      </h1>
      <p className="font-mono text-xs text-[color:var(--color-text-muted)] mt-2">
        By the engineers at Whatever Co. — {memberCount} members, {postCount} posts.
      </p>
    </section>
  );
}
```

- [ ] **Step 2: `src/components/MemberBelt.tsx` 書く（リンク版、フィルタは Task 8 で client 化）**

```tsx
import Link from "next/link";
import type { Member } from "@/types";

export function MemberBelt({ members }: { members: Member[] }) {
  return (
    <div className="flex flex-wrap gap-3 items-center py-5 border-b border-[color:var(--color-rule-solid)]">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-muted)] mr-3">
        Members
      </span>
      {members.map((m) => (
        <Link key={m.id} href={`/members/${m.id}`} title={m.name}>
          <img
            src={m.avatarSrc}
            alt={m.name}
            className="w-11 h-11 rounded-full object-cover grayscale hover:grayscale-0 hover:scale-105 transition-all"
          />
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `src/app/page.tsx` を Hero + MemberBelt 入りに更新**

```tsx
import { Hero } from "@/components/Hero";
import { MemberBelt } from "@/components/MemberBelt";
import { getAllMembers } from "@/lib/members";
import { getAllPosts } from "@/lib/posts";

export default function HomePage() {
  const members = getAllMembers();
  const posts = getAllPosts();
  return (
    <>
      <Hero memberCount={members.length} postCount={posts.length} />
      <MemberBelt members={members} />
    </>
  );
}
```

- [ ] **Step 4: 動作確認**

Run: `pnpm build:posts && pnpm dev`
Expected: トップに Hero とアバター帯。アバターは grayscale、hover で発色 + scale。

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "Add Hero and MemberBelt components on top page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: PostList（client component, フィルタ付き）+ PostRow

**Files:**
- Create: `src/components/PostList.tsx`（"use client"）, `src/components/PostRow.tsx`
- Modify: `src/app/page.tsx`, `src/components/MemberBelt.tsx`（フィルタ連動するなら client 化、別案として MemberBelt にもクリックハンドラを追加）

**Interfaces:**
- Consumes: `PostItem[]`, `Member[]`
- Produces:
  - `<PostList posts={PostItem[]} members={Member[]} />`（"use client"、`useSearchParams` で `?author=<id>` 読み取り）
  - `<PostRow post={PostItem} />`

**Note:** `MemberBelt` も client component にして、アバタークリック時に `router.push(?author=<id>)` で URL を更新する。トップでだけ使う「フィルタ版 MemberBelt」を `MemberBeltFilterable` として別コンポーネントに分けるのが整理しやすい。

- [ ] **Step 1: `src/components/PostRow.tsx` 書く**

```tsx
import type { PostItem } from "@/types";
import type { Member } from "@/types";

export function PostRow({ post, member }: { post: PostItem; member?: Member }) {
  const date = post.isoDate?.slice(0, 10) ?? "";
  return (
    <a
      href={post.link}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[92px_52px_1fr_110px] gap-[18px] items-center py-[18px] border-b border-dashed border-[color:var(--color-rule-dashed)] hover:bg-[color:var(--color-hover)]"
    >
      <span className="font-mono text-[13px] text-[color:var(--color-text-dim)]">{date}</span>
      <span>
        {member && (
          <img src={member.avatarSrc} alt="" className="w-10 h-10 rounded-full object-cover" />
        )}
      </span>
      <span className="leading-[1.45]">
        <span className="font-serif text-[17px] block mb-[3px] text-[color:var(--color-text)]">
          {post.title}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-dim)]">
          {post.sourceHost}
        </span>
      </span>
      <span className="font-mono text-[13px] text-[color:var(--color-text-muted)] text-right">
        {post.authorId}
      </span>
    </a>
  );
}
```

- [ ] **Step 2: `src/components/PostList.tsx` 書く（client）**

```tsx
"use client";

import { useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { PostItem, Member } from "@/types";
import { PostRow } from "./PostRow";

export function PostList({ posts, members }: { posts: PostItem[]; members: Member[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const authorFilter = searchParams.get("author");

  const filtered = useMemo(
    () => (authorFilter ? posts.filter((p) => p.authorId === authorFilter) : posts),
    [posts, authorFilter]
  );

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  function toggle(id: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (authorFilter === id) next.delete("author");
    else next.set("author", id);
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center py-5 border-b border-[color:var(--color-rule-solid)]">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-muted)] mr-3">
          Members
        </span>
        {members.map((m) => {
          const selected = authorFilter === m.id;
          const dim = authorFilter && !selected;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              title={m.name}
              className="rounded-full"
            >
              <img
                src={m.avatarSrc}
                alt={m.name}
                className={[
                  "w-11 h-11 rounded-full object-cover transition-all",
                  selected ? "ring-2 ring-[color:var(--color-rule-solid)]" : "",
                  dim ? "opacity-30" : "grayscale hover:grayscale-0 hover:scale-105",
                ].join(" ")}
              />
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[92px_52px_1fr_110px] gap-[18px] pt-6 pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
        <span>Date</span><span></span><span>Title</span><span className="text-right">Author</span>
      </div>

      {filtered.map((p) => (
        <PostRow key={p.link} post={p} member={memberMap.get(p.authorId)} />
      ))}

      {filtered.length === 0 && (
        <p className="py-12 text-center font-mono text-[color:var(--color-text-muted)]">
          No posts.
        </p>
      )}
    </>
  );
}
```

- [ ] **Step 3: `src/app/page.tsx` で PostList を使う（MemberBelt はもう PostList の中に含む。トップでは古い MemberBelt は使わない）**

```tsx
import { Suspense } from "react";
import { Hero } from "@/components/Hero";
import { PostList } from "@/components/PostList";
import { getAllMembers } from "@/lib/members";
import { getAllPosts } from "@/lib/posts";

export default function HomePage() {
  const members = getAllMembers();
  const posts = getAllPosts();
  return (
    <>
      <Hero memberCount={members.length} postCount={posts.length} />
      <Suspense>
        <PostList posts={posts} members={members} />
      </Suspense>
    </>
  );
}
```

注: `<Suspense>` で `useSearchParams` を使う client component をラップしないと export ビルドが失敗する。

- [ ] **Step 4: 動作確認**

Run: `pnpm dev`
Expected: トップに記事一覧。アバター帯を 1 つクリック → URL が `?author=<id>` になり、そのメンバーの記事だけ残る。同じアバター再クリックで解除。

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "Add PostList with author filter via ?author= and PostRow

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: メンバー一覧ページ `/members/`

**Files:**
- Create: `src/app/members/page.tsx`, `src/components/MemberCard.tsx`

**Interfaces:**
- Consumes: `getAllMembers()`
- Produces: `/members/` ページ、`<MemberCard member={Member} />`

- [ ] **Step 1: `src/components/MemberCard.tsx` 書く**

```tsx
import Link from "next/link";
import type { Member } from "@/types";

export function MemberCard({ member }: { member: Member }) {
  return (
    <Link
      href={`/members/${member.id}/`}
      className="flex items-center gap-4 py-5 border-b border-dashed border-[color:var(--color-rule-dashed)] hover:bg-[color:var(--color-hover)] px-2"
    >
      <img
        src={member.avatarSrc}
        alt={member.name}
        className="w-14 h-14 rounded-full object-cover"
      />
      <div>
        <div className="font-serif text-lg">{member.name}</div>
        {member.role && (
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--color-text-muted)]">
            {member.role}
          </div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: `src/app/members/page.tsx` 書く**

```tsx
import type { Metadata } from "next";
import { getAllMembers } from "@/lib/members";
import { MemberCard } from "@/components/MemberCard";

export const metadata: Metadata = { title: "Members" };

export default function MembersPage() {
  const members = getAllMembers();
  return (
    <section className="pt-16">
      <h1 className="font-serif italic text-4xl mb-8">Members</h1>
      <div>
        {members.map((m) => <MemberCard key={m.id} member={m} />)}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: 動作確認**

Run: `pnpm dev`
Expected: `/members/` で全メンバーが一覧表示。クリックで詳細ページ（次タスク）に遷移試行 → 404（OK、次で実装）。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "Add /members listing page and MemberCard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: メンバー詳細ページ `/members/[id]/`

**Files:**
- Create: `src/app/members/[id]/page.tsx`, `src/components/MemberProfileHeader.tsx`

**Interfaces:**
- Consumes: `getAllMembers()`, `getMember(id)`, `getPostsByAuthor(id)`
- Produces:
  - `/members/[id]/` ページ（generateStaticParams で全 ID 列挙）
  - `<MemberProfileHeader member={Member} postCount={number} />`

- [ ] **Step 1: `src/components/MemberProfileHeader.tsx` 書く**

```tsx
import type { Member } from "@/types";
import { FaGithub, FaTwitter, FaGlobe } from "react-icons/fa";

export function MemberProfileHeader({ member, postCount }: { member: Member; postCount: number }) {
  return (
    <section className="pt-16 pb-8 border-b border-[color:var(--color-rule-solid)]">
      <div className="flex items-start gap-6">
        <img
          src={member.avatarSrc}
          alt={member.name}
          className="w-24 h-24 rounded-full object-cover"
        />
        <div className="flex-1">
          <h1 className="font-serif italic text-4xl">{member.name}</h1>
          {member.role && (
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--color-text-muted)] mt-2">
              {member.role}
            </div>
          )}
          {member.bio && <p className="mt-4 text-[color:var(--color-text-muted)]">{member.bio}</p>}
          <div className="flex gap-4 mt-4 text-[color:var(--color-text-muted)]">
            {member.githubUsername && (
              <a href={`https://github.com/${member.githubUsername}`} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <FaGithub size={18} />
              </a>
            )}
            {member.twitterUsername && (
              <a href={`https://twitter.com/${member.twitterUsername}`} target="_blank" rel="noopener noreferrer" aria-label="X/Twitter">
                <FaTwitter size={18} />
              </a>
            )}
            {member.websiteUrl && (
              <a href={member.websiteUrl} target="_blank" rel="noopener noreferrer" aria-label="Website">
                <FaGlobe size={18} />
              </a>
            )}
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--color-text-dim)] mt-6">
            {postCount} posts
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `src/app/members/[id]/page.tsx` 書く**

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllMembers, getMember } from "@/lib/members";
import { getPostsByAuthor } from "@/lib/posts";
import { MemberProfileHeader } from "@/components/MemberProfileHeader";
import { PostRow } from "@/components/PostRow";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllMembers().map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const member = getMember(id);
  return { title: member?.name ?? "Member" };
}

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = getMember(id);
  if (!member) notFound();
  const posts = getPostsByAuthor(id);
  return (
    <>
      <MemberProfileHeader member={member} postCount={posts.length} />
      <div className="grid grid-cols-[92px_52px_1fr_110px] gap-[18px] pt-6 pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
        <span>Date</span><span></span><span>Title</span><span className="text-right">Source</span>
      </div>
      {posts.map((p) => <PostRow key={p.link} post={p} member={member} />)}
      {posts.length === 0 && (
        <p className="py-12 text-center font-mono text-[color:var(--color-text-muted)]">
          No posts yet.
        </p>
      )}
    </>
  );
}
```

- [ ] **Step 3: 動作確認**

Run: `pnpm dev`
Expected: `/members/saqoosha/` 等にプロフィールヘッダとその人の記事一覧。`/members/unknown/` で 404。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "Add /members/[id] dynamic route with generateStaticParams

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: About + 404 + sitemap + robots

**Files:**
- Create: `src/app/about/page.tsx`, `src/app/not-found.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`

**Interfaces:**
- Produces: `/about/`, `/404`, `/sitemap.xml`, `/robots.txt`

- [ ] **Step 1: `src/app/about/page.tsx` 書く**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { config } from "@site.config";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <section className="pt-16 max-w-[640px]">
      <h1 className="font-serif italic text-4xl mb-8">About</h1>
      <p className="leading-relaxed">
        <a href="https://whatever.co" target="_blank" rel="noopener noreferrer" className="underline">
          {config.siteMeta.teamName}
        </a>{" "}
        開発チームメンバーの各ブログを集約したサイトです。元実装は{" "}
        <a href="https://github.com/catnose99/team-blog-hub" target="_blank" rel="noopener noreferrer" className="underline">
          team-blog-hub
        </a>
        {" "}を基にしています。
      </p>
      <p className="mt-8">
        <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.08em] underline">
          ← Back home
        </Link>
      </p>
    </section>
  );
}
```

- [ ] **Step 2: `src/app/not-found.tsx` 書く**

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <section className="pt-32 text-center">
      <h1 className="font-serif italic text-6xl">404</h1>
      <p className="font-mono text-[color:var(--color-text-muted)] mt-4">Page not found.</p>
      <p className="mt-8">
        <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.08em] underline">
          ← Back home
        </Link>
      </p>
    </section>
  );
}
```

- [ ] **Step 3: `src/app/sitemap.ts` 書く**

```ts
import type { MetadataRoute } from "next";
import { config } from "@site.config";
import { getAllMembers } from "@/lib/members";

export default function sitemap(): MetadataRoute.Sitemap {
  const root = config.siteRoot.replace(/\/$/, "");
  const now = new Date();
  const base: MetadataRoute.Sitemap = [
    { url: `${root}/`, lastModified: now },
    { url: `${root}/about/`, lastModified: now },
    { url: `${root}/members/`, lastModified: now },
  ];
  const members = getAllMembers().map((m) => ({
    url: `${root}/members/${m.id}/`,
    lastModified: now,
  }));
  return [...base, ...members];
}
```

- [ ] **Step 4: `src/app/robots.ts` 書く**

```ts
import type { MetadataRoute } from "next";
import { config } from "@site.config";

export default function robots(): MetadataRoute.Robots {
  const root = config.siteRoot.replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${root}/sitemap.xml`,
  };
}
```

- [ ] **Step 5: 動作確認 + 静的ビルド**

Run: `pnpm dev`
Expected: `/about/`, `/404`, `/sitemap.xml`, `/robots.txt` が動作

Run: `pnpm build`
Expected: ビルド成功、`out/` に `sitemap.xml`, `robots.txt`, `members/<id>/index.html` が生成

- [ ] **Step 6: ローカル静的配信確認**

Run: `pnpm dlx serve out -p 4000`
Expected: `http://localhost:4000` で全ページが配信される。`/feed.xml` も配信される。

- [ ] **Step 7: コミット**

```bash
git add -A
git commit -m "Add /about, /404, sitemap.xml, robots.txt

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Cloudflare Worker + Cron Trigger + デプロイ手順

**Files:**
- Create: `wrangler.toml`, `src/worker/index.ts`, README.md（全置換）
- Modify: `.gitignore`（`.dev.vars` 追加）

**Interfaces:**
- Consumes: Cloudflare アカウント、Workers Builds の Deploy Hook URL
- Produces: 1 つの Worker が Static Assets 配信 + 日次 scheduled handler

- [ ] **Step 1: `wrangler.toml` 書く**

```toml
name = "team-blog-hub"
main = "src/worker/index.ts"
compatibility_date = "2026-01-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./out"
binding = "ASSETS"
not_found_handling = "404-page"

[triggers]
crons = ["0 17 * * *"]

[vars]
SITE_ORIGIN = "https://team-blog-hub.workers.dev"

# BUILD_HOOK_URL is set via `wrangler secret put BUILD_HOOK_URL`
```

- [ ] **Step 2: `src/worker/index.ts` 書く**

```ts
export interface Env {
  ASSETS: Fetcher;
  BUILD_HOOK_URL: string;
  SITE_ORIGIN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.BUILD_HOOK_URL) {
      console.error("[cron] BUILD_HOOK_URL is not set");
      return;
    }
    ctx.waitUntil(
      fetch(env.BUILD_HOOK_URL, { method: "POST" }).then(async (res) => {
        if (!res.ok) {
          console.error(`[cron] deploy hook failed: ${res.status} ${await res.text()}`);
        } else {
          console.log(`[cron] deploy hook triggered: ${res.status}`);
        }
      })
    );
  },
};
```

- [ ] **Step 3: `.dev.vars` を gitignore に追加**

`.gitignore` に追記:
```
.dev.vars
```

- [ ] **Step 4: ローカルで Worker を試す（assets binding 動作確認）**

Run: `pnpm build && pnpm dlx wrangler dev`
Expected: `http://localhost:8787` で全ページが配信される（dev は Cron 動かない）。

- [ ] **Step 5: README.md を新規に置き換える**

```markdown
# Team Blog Hub

Whatever Co. のエンジニアによるブログ記事を集約したサイト。

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- 静的 export → Cloudflare Workers (Static Assets binding)
- 日次の RSS 取り込み & 再デプロイは Cloudflare Cron Trigger + Workers Builds Deploy Hook

## Development

```bash
pnpm install
pnpm build:posts     # RSS 取得 (.contents/posts.json)
pnpm build:feeds     # RSS/Atom フィード生成
pnpm dev             # Next.js dev server (http://localhost:3000)
pnpm build           # 静的 export (out/)
pnpm test            # Vitest
```

## Configuration

- `members.ts` — メンバーと RSS ソース定義
- `site.config.ts` — サイトメタ情報・ヘッダリンク
- `src/app/globals.css` — デザイントークン (Tailwind v4 `@theme`)

## Deployment

通常は `git push origin main` で Cloudflare Workers Builds が自動ビルド & デプロイ。

手動デプロイ:
```bash
pnpm deploy
```

### Setup (one-time)

1. Cloudflare ダッシュボードで Workers Builds を有効化し、この GitHub リポジトリを接続
2. Workers Builds の設定で Deploy Hook URL を作成
3. その URL を Worker のシークレットに登録:
   ```bash
   pnpm wrangler secret put BUILD_HOOK_URL
   ```
4. 本番ドメインを Custom Domain として割り当て、`wrangler.toml` と `site.config.ts` の `SITE_ORIGIN` / `siteRoot` を更新

### Cron

`wrangler.toml` の `[triggers]` で `0 17 * * *`（UTC = JST 02:00）に設定。Worker の `scheduled` handler が `BUILD_HOOK_URL` を POST → Workers Builds が `pnpm build` + デプロイ。

## License

MIT
```

- [ ] **Step 6: 全テスト & ビルド再実行**

Run: `pnpm test && pnpm build`
Expected: 全テスト PASS、ビルド成功、`out/` 生成

- [ ] **Step 7: コミット**

```bash
git add -A
git commit -m "Add Cloudflare Worker, Cron Trigger config, and README

- wrangler.toml with Static Assets binding and daily cron
- src/worker/index.ts: scheduled handler fetches BUILD_HOOK_URL
- Replace README with new dev/deploy instructions
- Gitignore .dev.vars

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 8: 本番デプロイ確認（手動・手順のみ）**

ユーザー側手順（このタスクでは実行しない）:
1. `wrangler login`
2. Cloudflare ダッシュボードで Workers Builds 有効化 → GitHub 接続 → Deploy Hook URL 取得
3. `pnpm wrangler secret put BUILD_HOOK_URL` で登録
4. `git push origin feat/redesign-cloudflare-migration` → Workers Builds がプレビュー Worker をデプロイ
5. 動作確認 → main にマージ → 本番 Worker デプロイ
6. Custom Domain 割り当て後、`SITE_ORIGIN` / `siteRoot` 更新で再デプロイ
7. 翌日 02:00 JST に Cron Trigger が発火することを Cloudflare の Cron Triggers ログで確認

---

## Self-Review

**1. Spec coverage:**
- [x] §2 ゴール: 全項目を Task 1 / 6 / 12 が満たす
- [x] §3 アーキテクチャ図: Task 1 (Next) / 4-5 (build scripts) / 12 (Worker + Cron)
- [x] §4 ページ構成: トップ Task 6-8, /members Task 9, /members/[id] Task 10, /about Task 11, /404 Task 11, /feed.xml + /feed.atom Task 5, /robots.txt + /sitemap.xml Task 11
- [x] §5 デザインシステム: Task 2 (トークン), Task 6 (Header), Task 7 (Hero/MemberBelt), Task 8 (PostList/PostRow)
- [x] §6 データフロー: Task 4 (build-posts) + Task 5 (build-feeds)
- [x] §7 Cron 戦略: Task 12 (scheduled handler + cron trigger)
- [x] §8 デプロイ: Task 12 (wrangler.toml + README)
- [x] §9 移行方針: Task 1 (旧コード削除), site.config 更新 Task 5
- [x] §10 リスク: useSearchParams + Suspense は Task 8 Step 3 で対応

**2. Placeholder scan:** 設計書由来の「実装フェーズで決定」項目（フォント具体銘柄、Custom Domain）は意図的に残し、プラン上で具体値を割り当て（Source Serif 4 / JetBrains Mono、暫定 `team-blog-hub.workers.dev`）。プラン内に TBD / TODO は無し。

**3. Type consistency:** `PostItem` / `Member` の型は Task 3 で定義し、以降 Task 4, 5, 7, 8, 9, 10 すべてで同じシグネチャを参照。関数名 (`getAllPosts`, `getPostsByAuthor`, `getAllMembers`, `getMember`, `normalizeFeedItem`, `extractSourceHost`, `buildFeed`) は Interfaces で宣言したものを使用箇所と一致させた。

---

## 補足

- 旧 `react-icons` を引き続き利用（v5 系、メンバープロフィールの SNS アイコン用）
- `dayjs` は最終的に未使用なら Task 12 までで `package.json` から外す（現状は念のため含めた。利用箇所が無いまま Task 12 まで来たら削除して再コミット）
- フォントの Source Serif 4 / JetBrains Mono は `next/font/google` で読み込むため CSP / フォントホスト変更時は `layout.tsx` を見直す
