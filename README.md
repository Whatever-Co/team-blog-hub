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
