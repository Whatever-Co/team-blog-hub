import { Feed } from "feed";
import fs from "fs-extra";
import path from "node:path";
import { config } from "../site.config";
import type { PostItem } from "../src/types";

/** Strip XML 1.0-invalid controls and break CDATA-terminator sequences before feed lib wraps content. */
function sanitizeFeedText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\]\]>/g, "]]]]><![CDATA[>");
}

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
      title: sanitizeFeedText(p.title),
      id: p.link,
      link: p.link,
      description: p.contentSnippet ? sanitizeFeedText(p.contentSnippet) : undefined,
      date: new Date(p.dateMiliSeconds),
      author: [{
        name: p.authorName,
        link: `${siteRoot}/members/${p.authorId}/`,
      }],
    });
  }

  return type === "rss2" ? feed.rss2() : feed.atom1();
}

async function main() {
  const postsPath = path.resolve(".contents/posts.json");
  let posts: PostItem[];
  try {
    posts = await fs.readJson(postsPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`[build-feeds] ${postsPath} not found — run \`pnpm build:posts\` first`);
    }
    throw err;
  }
  const siteRoot = config.siteRoot;
  await fs.outputFile(path.resolve("public/feed.xml"), buildFeed(posts, siteRoot, "rss2"));
  await fs.outputFile(path.resolve("public/feed.atom"), buildFeed(posts, siteRoot, "atom1"));
  console.log(`[build-feeds] wrote feed.xml and feed.atom with ${posts.length} posts`);
}

if (process.argv[1] && process.argv[1].endsWith("build-feeds.ts")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
