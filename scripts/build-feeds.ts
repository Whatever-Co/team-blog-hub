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
      author: [{
        name: p.authorName,
        email: `${p.authorId}@team-blog-hub.local`,
        link: `${siteRoot}/members/${p.authorId}`,
      }],
    });
  }

  const xml = type === "rss2" ? feed.rss2() : feed.atom1();
  return xml
    .replace(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/g, "<title>$1</title>")
    .replace(
      /<title type="html"><!\[CDATA\[([\s\S]*?)\]\]><\/title>/g,
      "<title>$1</title>"
    )
    .replace(/<title type="html">([\s\S]*?)<\/title>/g, "<title>$1</title>");
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
