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
