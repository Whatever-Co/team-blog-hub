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
    expect(xml).toContain("Hello");
    expect(xml).toContain("<rss");
    expect(xml).toContain("https://zenn.dev/a/articles/b");
  });

  it("emits valid Atom XML with entry", () => {
    const xml = buildFeed(SAMPLE, "https://example.com", "atom1");
    expect(xml).toContain("Hello");
    expect(xml).toContain("<feed");
    expect(xml).toContain("<entry>");
    expect(xml).toContain("Alice");
  });

  it("returns valid RSS for empty posts without throwing", () => {
    const xml = buildFeed([], "https://example.com", "rss2");
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain("<rss");
  });

  it("round-trips titles with XML metacharacters without stray tags", () => {
    const posts: PostItem[] = [{
      authorId: "alice",
      authorName: "Alice",
      title: "[Unity] ReadOnlySpan<T> & more",
      link: "https://example.com/post",
      isoDate: "2026-01-15T00:00:00Z",
      dateMiliSeconds: new Date("2026-01-15T00:00:00Z").getTime(),
      sourceHost: "example.com",
    }];
    const xml = buildFeed(posts, "https://example.com", "rss2");
    expect(xml).toMatch(/ReadOnlySpan/);
    expect(xml).not.toMatch(/<T>[^<]*<\/T>/);
  });
});
