# AGENTS.md — team-blog-hub プロジェクト知識

## これは何

Whatever Co. のエンジニア各自のブログ（Zenn / Qiita / note 等）を RSS で集約して表示する 100% 静的サイト。Cloudflare Workers (Static Assets binding) でホスティング、Cron Trigger が毎日 02:00 JST に Workers Builds の Deploy Hook を叩いて再ビルド → 最新記事を反映する。

ユーザー向け基本情報は README.md。このファイルはエージェント運用知識（コマンド・インフラ台帳・実体験のハマりどころ）専用。

## スタック / 構成

- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- `output: 'export'` + `trailingSlash: true` で完全静的化
- Cloudflare Workers + `[assets]` binding（`./out` を配信）
- 同じ Worker の `scheduled` handler が日次 cron で Deploy Hook を POST
- ビルドパイプライン: `pnpm prebuild` → `build:posts`（Zenn/note は RSS、Qiita は REST API → `.contents/posts.json`）→ `build:feeds`（RSS 2.0 + Atom 生成）→ `next build`
- ビルド時生成物（`.contents/`, `public/feed.xml`, `public/feed.atom`）は **gitignored**。コミットしない

## コマンド

### ローカル
```bash
pnpm install
pnpm build:posts                                   # RSS fetch（要ネット）
pnpm test                                          # Vitest（23 tests）
pnpm exec tsc --noEmit                             # 型チェック (= pnpm lint)
SITE_ORIGIN=https://dev-blog.whatever.co pnpm build
                                                   # 本番と同じ origin で静的 export
xmllint --noout out/feed.xml out/feed.atom         # 生成フィードの XML 妥当性
pnpm dev                                           # http://localhost:3000（要 build:posts 済）
```

### Cloudflare
```bash
pnpm wrangler secret put BUILD_HOOK_URL            # 要 wrangler.toml に account_id（後述）
pnpm wrangler deploy --dry-run --outdir /tmp/wrangler-dry  # bundle 検証のみ
pnpm wrangler deploy                               # ローカルから本番デプロイ
```

通常デプロイは `git push origin main` だけで Workers Builds が走る。

### GitHub
```bash
gh repo set-default Whatever-Co/team-blog-hub      # この設定なしだと gh は upstream の catnose99 を選んでしまう
gh pr view <N> --json mergeable,mergeStateStatus,statusCheckRollup
```

## インフラ台帳

| 項目 | 値 |
|---|---|
| Cloudflare account | Whatever Co. (`c21a10f70a8036d2ad10687ab83bfb4b`) |
| Workers subdomain | `whatever-co.workers.dev` |
| 本番 URL | https://dev-blog.whatever.co/ （Custom Domain）|
| workers.dev URL | https://team-blog-hub.whatever-co.workers.dev/ （直アクセス可だが正規は Custom Domain）|
| Worker name | `team-blog-hub` |
| Custom Domain | `dev-blog.whatever.co`, zone `whatever.co` (`ff99342a00518a9e9d998af0828fd9e5`), Worker Domain ID `4bc78ed7922f45dee9260d29949752e7216c470b`、wrangler.toml `[[routes]] custom_domain=true` で declarative 管理 |
| Deploy Hook | name `daily-rebuild`, branch `main`, ID `54995682-f4ab-4425-8a5f-6c0b34d299bb` |
| Cron schedule | `0 17 * * *` UTC = 02:00 JST |
| Build env var | `SITE_ORIGIN=https://dev-blog.whatever.co` (Workers Builds → Variables, **not** runtime)。未設定なら `site.config.ts` の prod fallback (`https://dev-blog.whatever.co`) を使う |
| Runtime secret | `BUILD_HOOK_URL` (wrangler secret) |
| GitHub remote (origin) | `git@github.com:Whatever-Co/team-blog-hub.git` |
| GitHub remote (upstream, fetch only) | `git://github.com/catnose99/team-blog-hub.git`（元 fork） |

## ファイル構造

```
team-blog-hub/
├─ members.ts                            # メンバー定義（trusted 入力、ハンドル＋RSS source 配列）
├─ site.config.ts                        # サイトメタ・ヘッダリンク。siteRoot は SITE_ORIGIN env 優先
├─ next.config.ts                        # output: 'export', trailingSlash: true, images.unoptimized
├─ wrangler.toml                         # Worker name + account_id + [assets]./out + cron
├─ postcss.config.mjs                    # @tailwindcss/postcss だけ
├─ vitest.config.ts                      # path alias を src/scripts と揃える
├─ tsconfig.json                         # strict、`src/worker` は exclude（wrangler が別管理）
│
├─ scripts/                              # tsx で直接実行されるビルド時スクリプト
│  ├─ build-posts.ts                     # 全 member の RSS を並列 fetch → .contents/posts.json
│  └─ build-feeds.ts                     # posts.json → public/feed.xml + public/feed.atom
│
├─ src/
│  ├─ types.ts                           # Member, PostItem (sourceHost 必須)
│  │
│  ├─ lib/                               # データ読み込みヘルパ
│  │  ├─ posts.ts                        # getAllPosts / getPostsByAuthor (.contents/posts.json を import)
│  │  └─ members.ts                      # getAllMembers / getMember
│  │
│  ├─ app/                               # App Router
│  │  ├─ layout.tsx                      # next/font (Source_Serif_4 + JetBrains_Mono) + Header
│  │  ├─ globals.css                     # Tailwind v4 @theme（色・フォントトークン）
│  │  ├─ page.tsx                        # トップ: Hero + <Suspense><PostList /></Suspense>
│  │  ├─ not-found.tsx                   # 404
│  │  ├─ sitemap.ts                      # MetadataRoute.Sitemap（要 dynamic="force-static"）
│  │  ├─ robots.ts                       # MetadataRoute.Robots（同上）
│  │  ├─ about/page.tsx
│  │  └─ members/
│  │     ├─ page.tsx                     # 一覧
│  │     └─ [id]/page.tsx                # 詳細。generateStaticParams + dynamic="force-static"
│  │
│  ├─ components/
│  │  ├─ Header.tsx                      # ロゴ + nav（全リンクに trailing slash 必須）
│  │  ├─ Hero.tsx                        # "Engineering log." セリフ斜体
│  │  ├─ MemberBelt.tsx                  # 静的アバター帯（/members/[id]/ への遷移）
│  │  ├─ MemberCard.tsx                  # /members 一覧の各行
│  │  ├─ MemberProfileHeader.tsx         # /members/[id] のヘッダ（react-icons）
│  │  ├─ PostList.tsx                    # "use client" — useSearchParams で ?author= filter
│  │  │                                  #   フィルタ用アバター帯も内蔵（MemberBelt 別物）
│  │  └─ PostRow.tsx                     # 各記事行。showAuthor=false で member 詳細用 3 列レイアウト
│  │
│  └─ worker/
│     └─ index.ts                        # fetch: ASSETS pass-through / scheduled: BUILD_HOOK_URL POST
│
├─ tests/                                # Vitest（scripts のみ対象、UI は対象外）
│  ├─ build-posts.test.ts                # 7 tests
│  └─ build-feeds.test.ts                # 4 tests
│
├─ public/
│  ├─ avatars/*.jpg                      # メンバー写真。Image optimize 不要 (next: unoptimized)
│  ├─ favicon.ico, icon-256x256.png 等
│  └─ feed.xml, feed.atom                # ← gitignored。ビルド時生成
│
├─ .contents/posts.json                  # ← gitignored。ビルド時生成
│
├─ docs/superpowers/
│  ├─ specs/2026-06-28-team-blog-hub-redesign-design.md   # 設計書（実装前のスナップショット）
│  └─ plans/2026-06-28-team-blog-hub-redesign.md          # 実装プラン（同上）
│
├─ README.md                             # 人間向け
├─ AGENTS.md                             # このファイル
└─ CLAUDE.md → AGENTS.md                 # symlink（Claude Code 自動ロード用）
```

データの流れ:
```
RSS feeds → scripts/build-posts.ts → .contents/posts.json
                                          ↓
                                     src/lib/posts.ts ← src/app/**/page.tsx
                                          ↓
                                     scripts/build-feeds.ts → public/feed.{xml,atom}
                                          ↓
                                     next build → out/
                                          ↓
                                     wrangler deploy → Worker (ASSETS binding serves out/)
```

## データの意味論

- `members.ts` — メンバー定義。`sources`（フィード URL の配列）と `includeUrlRegex` / `excludeUrlRegex`（オプション）で記事を絞る。`members.ts` は trusted 入力扱い（コミッター制御下）
- `sources` 内の `https://qiita.com/<user>/feed` 形式 URL は `build-posts.ts` の `qiitaUserFromFeedUrl` で検出され、**RSS パーサではなく Qiita REST API** (`https://qiita.com/api/v2/users/<user>/items`) 経由でフル履歴を取得する。それ以外（zenn.dev / note.com / その他）は `rss-parser` がそのまま fetch
- Qiita API レスポンスは `per_page=100&page=N` でページネーション、`page` を 1 から増やして配列長が `per_page` 未満になったら停止。safety cap は 10 ページ (1000 件)
- Qiita の `contentSnippet` は `rendered_body`（HTML）からタグを剥がして 200 文字。`body` は Markdown なので `#`/`[text](url)`/コードフェンスがそのまま入って汚い → `rendered_body` 優先で fallback が `body`
- `.contents/posts.json` — ビルド時生成。`PostItem[]`、日付降順
- `PostItem.contentSnippet` は出力フィード（`public/feed.{xml,atom}`）の `<description>` だけに使われる。**サイト UI（`PostList` / `PostRow`）は title と date しか表示しない**
- `PostItem.sourceHost` — `link` の hostname から `www.` を 1 段だけ literal に剥がした値（`www2.example.com` は変換しない）。`normalizeFeedItem` 内で `parsed.hostname` を再利用して生成
- `PostItem.dateMiliSeconds` — `isoDate` が missing / NaN の post は `normalizeFeedItem` が `null` を返して捨てる。`0` で残すと feed の `<pubDate>` が 1970-01-01 化して aggregator が古い記事と誤判定する
- `?author=<id>` クエリ — トップページ `PostList` で記事フィルタ。`useSearchParams` を `<Suspense fallback={null}>` で囲まないと `output: 'export'` のビルドが落ちる
- フィードの `<author>` は `name` のみ（email を持たせると偽メアドになる、付けない方が validator 通る）

## ハマりどころ（実体験）

### `pnpm build` が `.next/export/500.html` の ENOENT で死ぬ
- 症状: `[Error: ENOENT: no such file or directory, rename '/.../.next/export/500.html'`
- 原因: `pnpm dev` がバックグラウンドで動いていて `.next/` を握っている
- 修正: `ps -eo pid,command | grep -E "next dev|next-server" | grep -v grep` で PID を出して `kill <pid>`、`rm -rf .next out` して再ビルド

### `git push origin <branch>` が「Everything up-to-date」と嘘をつく
- 症状: ローカルが remote より進んでるのに push しない
- 原因（推測）: HEAD detached の状態でコミットを積んだ後にブランチへチェックアウトすると、ブランチ ref が古いまま残ることがある
- 回避: `git push origin HEAD:refs/heads/<branch>` で明示的に refspec を指定すると push される
- 再発防止: `cursor-agent` が走った後は `git status -sb` で `## HEAD (no branch)` になっていないか確認

### Composer 実行中に HEAD detach
- 症状: `cursor-agent` (Composer) が `git commit` を実行すると HEAD detached のまま戻ってくることがある
- 回避: Composer 後に `git checkout <branch>` → `git merge --ff-only origin/<branch>` で追従

### 生成フィードの XML が壊れる（`<title>[Unity] ReadOnlySpan<T>...</title>` で xmllint 失敗）
- 症状: `xmllint --noout public/feed.xml` が `Opening and ending tag mismatch: T line N and title`
- 原因: `feed` lib が title を `<![CDATA[...]]>` でラップしているのを、独自 regex で外して生 XML に戻していたため
- 修正: `scripts/build-feeds.ts` の title-rewrite regex を全削除し、`feed.rss2()` / `feed.atom1()` の出力をそのまま返す。CDATA は妥当な XML

### フィードの `<link>` に `http://localhost:3000` が baked される
- 症状: `out/feed.xml` `out/feed.atom` の `<link>` が localhost
- 原因: `prebuild` が `next build` より先に走るため、`build:feeds` 実行時はまだ `NODE_ENV` が production になっていない
- 修正: `site.config.ts` の `siteRoot` を `process.env.SITE_ORIGIN || (NODE_ENV === 'production' ? ... : 'http://localhost:3000')` にして、Workers Builds の Variables から `SITE_ORIGIN` を注入する

### RSS 内の制御文字（`` 等）で xmllint が落ちる
- 症状: 実 RSS データを feed lib に通すと制御文字がそのまま出て XML 不正
- 修正: `scripts/build-feeds.ts` に `sanitizeFeedText` を入れて C0 制御文字を除去（Composer が自発的に追加した妥当な処理）

### `/about` `/members` リンクが 404
- 症状: `output: 'export' + trailingSlash: true` の組み合わせで Cloudflare Workers Static Assets が `/about` を 301 redirect / 404
- 原因: 生成物が `out/about/index.html` なので、リンクも `/about/` で終わる必要がある
- 修正: `Header.tsx` `MemberBelt.tsx` 内のすべての内部リンクに trailing slash を付ける

### git push で Cloudflare Workers Builds が走らない（webhook が届かない）
- 症状: `git push origin main` しても Cloudflare のビルド履歴に出てこない、GitHub commit に `Workers Builds: team-blog-hub` の check-run が付かない、Settings で「This project is disconnected from your Git account.」警告が消えない
- 原因: Cloudflare の Worker setup wizard で repo を選んだだけでは GitHub App `cloudflare-workers-and-pages` (installation id `26564529`) の **selected repositories に team-blog-hub が自動追加されない**。Cloudflare 側で connect 設定があっても、GitHub App に repo access が無いと push event を Cloudflare に送らない
- 確認: `gh api orgs/Whatever-Co/installations` で `repository_selection: "selected"` なら、対象 repo が selected list に含まれてるか確認が必要（list 自体は app 認証必要で `gh` では取れない、ブラウザで見る）
- 修正: https://github.com/organizations/Whatever-Co/settings/installations/26564529 → "Repository access" で team-blog-hub を追加 → Save。直後の push で check-run が即座（1 秒以内）に立つ
- Cloudflare ダッシュボードでの Disconnect → Reconnect は**この問題を直さない**（Cloudflare 側の state だけ更新するため）

### `wrangler secret put` が「unable to select account in non-interactive mode」で死ぬ
- 症状: `saqoosha@whatever.co` ユーザーが個人アカウントと `Whatever Co.` の両方に属していて wrangler が選べない
- 修正: `wrangler.toml` に `account_id = "c21a10f70a8036d2ad10687ab83bfb4b"` を書く（コミット済み）

### Cloudflare ダッシュボードの入力欄に `evaluate_script` で値を流すと最初の 1 文字が落ちる
- 症状: `fill_form` 等で `"SITE_ORIGIN"` を入れたつもりが `"ITE_ORIGIN"` に
- 原因（推測）: フォーカス/選択の race
- 回避: `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)` で直接 setter を呼んでから `input` / `change` イベントを発火する

### dayjs を入れたが結局使わない
- 過去にあったが今は date 整形は `isoDate.slice(0, 10)` だけで足りるので `pnpm remove dayjs` 済み。今後も入れる必要は基本ない

### Qiita の native Atom feed (`qiita.com/<user>/feed`) は最新 3〜4 件しか返さない
- 症状: `https://qiita.com/<user>/feed` を `rss-parser` に通すと 1 ユーザーあたり 3〜4 件しか取れず、過去記事が全部消える
- 原因: Qiita 公式 Atom フィードの仕様（最新ごく少数のみ）。RSS reader 用途には十分だが集約サイトには不足
- 修正: `scripts/build-posts.ts` の `qiitaUserFromFeedUrl` で `qiita.com/<user>/feed` を検出して REST API (`qiita.com/api/v2/users/<user>/items?per_page=100&page=N`) に切り替えてフル履歴取得
- 注意: API はトークン無しで **60 req/hour/IP**。現状 Qiita メンバー 7 人 × 最大数ページ = 数十リクエスト/ビルドで十分余裕

### `vi.restoreAllMocks()` は `vi.stubGlobal()` を unstub しない
- 症状: テスト間で `fetch` のモックがリークして別ファイルのテストが奇妙な挙動になる
- 原因: Vitest の `restoreAllMocks` は `vi.fn()` / `vi.spyOn()` で作ったモックしか戻さない。`stubGlobal` で差し替えたグローバルは別の関数で戻す必要がある
- 修正: `afterEach` で `vi.unstubAllGlobals()` を呼ぶ（または `vitest.config.ts` で `test.unstubGlobals: true`）。`restoreAllMocks` と併用して両方戻す
- 該当: `tests/build-posts.test.ts` の `fetchQiitaItems` describe ブロック

## 検証で使える基準値

- `pnpm test` → 23 tests passed（2 ファイル: build-posts 19, build-feeds 4）
- `pnpm build:posts` → 約 160〜170 件前後（内訳目安: zenn.dev 60 / note.com 18 / qiita.com 80〜90、メンバーの投稿頻度で変動）
- `pnpm build` → 16 static pages（`/`, `/about/`, `/members/`, `/members/<id>/` × 8, `/404`, `/sitemap.xml`, `/robots.txt`, あと `_next/*`）
- Worker bundle: 約 22 KiB（`wrangler deploy --dry-run` 出力）
- `out/feed.xml` ~ 100 KB / `out/feed.atom` ~ 120 KB
- `grep -c localhost out/feed.xml out/feed.atom out/sitemap.xml` → 全部 0
- `[build-posts] Qiita user "<name>" returned 0 items` warning は正常動作（API 経由でハンドル空・退会の検知）。0 件の継続が想定外なら `members.ts` から削除を検討

## 残タスク

- 旧 `whatever-dev-blog.vercel.app` から `https://dev-blog.whatever.co/` への 301 リダイレクト（Vercel 側で設定、または放置）
- 翌日 02:00 JST 以降に Cloudflare ダッシュボード Settings > Build > Deploy Hooks の `daily-rebuild` の "Last triggered" を見て cron 動作確認
- Lighthouse スコア未測定。デザイン spec の成功基準は 95+
