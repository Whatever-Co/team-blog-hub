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

const QIITA_FEED_RE = /^https?:\/\/qiita\.com\/([^/?#]+)\/feed\/?$/;

export function qiitaUserFromFeedUrl(url: string): string | null {
  const m = url.match(QIITA_FEED_RE);
  return m ? m[1] : null;
}

type QiitaApiItem = {
  title?: string;
  url?: string;
  created_at?: string;
  body?: string;
  rendered_body?: string;
};

const QIITA_PER_PAGE = 100;
const QIITA_MAX_PAGES = 10;
const QIITA_FETCH_TIMEOUT_MS = 15_000;

function qiitaSnippet(it: QiitaApiItem): string | undefined {
  const source = it.rendered_body ?? it.body;
  if (!source) return undefined;
  return source.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 200) || undefined;
}

export async function fetchQiitaItems(user: string): Promise<RawItem[]> {
  const collected: QiitaApiItem[] = [];

  for (let page = 1; page <= QIITA_MAX_PAGES; page++) {
    const res = await fetch(
      `https://qiita.com/api/v2/users/${user}/items?per_page=${QIITA_PER_PAGE}&page=${page}`,
      { signal: AbortSignal.timeout(QIITA_FETCH_TIMEOUT_MS) }
    );
    if (!res.ok) {
      throw new Error(`Qiita API responded ${res.status} for user ${user} (page ${page})`);
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      throw new Error(`Qiita API returned non-array for user ${user} (page ${page})`);
    }
    collected.push(...(data as QiitaApiItem[]));
    if (data.length < QIITA_PER_PAGE) break;
    if (page === QIITA_MAX_PAGES) {
      console.warn(
        `[build-posts] Qiita user "${user}" hit pagination cap (${QIITA_MAX_PAGES} pages of ${QIITA_PER_PAGE}); older items may be omitted`
      );
    }
  }

  if (collected.length === 0) {
    console.warn(`[build-posts] Qiita user "${user}" returned 0 items — verify handle is still valid`);
  }

  return collected.map((it) => ({
    title: it.title,
    link: it.url,
    isoDate: it.created_at,
    contentSnippet: qiitaSnippet(it),
  }));
}

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
  if (!isoDate) {
    console.warn(`[build-posts] dropping post with missing isoDate: ${link}`);
    return null;
  }
  const dateMiliSeconds = new Date(isoDate).getTime();
  if (Number.isNaN(dateMiliSeconds)) {
    console.warn(`[build-posts] dropping post with invalid isoDate "${isoDate}": ${link}`);
    return null;
  }
  return {
    authorId,
    authorName,
    title,
    link,
    isoDate,
    dateMiliSeconds,
    contentSnippet: contentSnippet?.replace(/\n/g, ""),
    sourceHost: parsed.hostname.replace(/^www\./, ""),
  };
}

async function fetchMember(member: Member, parser: Parser): Promise<{ items: PostItem[]; failed: string[] }> {
  if (!member.sources?.length) return { items: [], failed: [] };
  const items: PostItem[] = [];
  const failed: string[] = [];

  let includeRe: RegExp | undefined;
  let excludeRe: RegExp | undefined;
  try {
    includeRe = member.includeUrlRegex ? new RegExp(member.includeUrlRegex) : undefined;
    excludeRe = member.excludeUrlRegex ? new RegExp(member.excludeUrlRegex) : undefined;
  } catch (err) {
    throw new Error(`[build-posts] member ${member.id} has invalid regex: ${(err as Error).message}`);
  }

  for (const url of member.sources) {
    let rawItems: RawItem[];
    const qiitaUser = qiitaUserFromFeedUrl(url);
    try {
      if (qiitaUser) {
        rawItems = await fetchQiitaItems(qiitaUser);
      } else {
        const feed = await parser.parseURL(url);
        rawItems = feed.items ?? [];
      }
    } catch (err) {
      console.warn(`[build-posts] failed to fetch ${url}:`, (err as Error).message);
      failed.push(url);
      continue;
    }
    for (const raw of rawItems) {
      const norm = normalizeFeedItem(raw, member.id, member.name);
      if (norm) items.push(norm);
    }
  }

  const filtered = items
    .filter((p) => !includeRe || includeRe.test(p.link))
    .filter((p) => !excludeRe || !excludeRe.test(p.link));

  return { items: filtered, failed };
}

async function main() {
  const parser = new Parser();
  const results = await Promise.all(members.map((m) => fetchMember(m, parser)));
  const all = results.flatMap((r) => r.items);
  const failed = results.flatMap((r) => r.failed);
  const totalSources = members.flatMap((m) => m.sources ?? []).length;

  if (failed.length > 0) {
    if (failed.length / totalSources > 0.5) {
      console.error(`[build-posts] more than 50% of RSS sources failed (${failed.length}/${totalSources}):`, failed);
      process.exit(1);
    }
    console.warn(`[build-posts] some RSS sources failed (${failed.length}/${totalSources}):`, failed);
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
