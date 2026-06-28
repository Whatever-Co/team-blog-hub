import { describe, it, expect } from "vitest";
import { normalizeFeedItem, extractSourceHost } from "../scripts/build-posts";

describe("extractSourceHost", () => {
  it("returns hostname without www", () => {
    expect(extractSourceHost("https://zenn.dev/foo/articles/bar")).toBe("zenn.dev");
    expect(extractSourceHost("https://www.qiita.com/x")).toBe("qiita.com");
    expect(extractSourceHost("not a url")).toBe("");
  });

  it("only strips literal www. prefix", () => {
    expect(extractSourceHost("https://www2.example.com")).toBe("www2.example.com");
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

  it("returns null when isoDate is missing", () => {
    expect(
      normalizeFeedItem({ title: "Hi", link: "https://x.com/a" }, "alice", "Alice")
    ).toBeNull();
  });

  it("returns null when isoDate is invalid", () => {
    expect(
      normalizeFeedItem(
        { title: "Hi", link: "https://x.com/a", isoDate: "totally invalid" },
        "alice",
        "Alice"
      )
    ).toBeNull();
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
