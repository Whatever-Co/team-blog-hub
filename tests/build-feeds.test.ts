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
