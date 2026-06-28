import { describe, it, expect, vi, afterEach } from "vitest";
import { normalizeFeedItem, extractSourceHost, qiitaUserFromFeedUrl, fetchQiitaItems } from "../scripts/build-posts";

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

describe("qiitaUserFromFeedUrl", () => {
  it("extracts user id from a Qiita feed URL", () => {
    expect(qiitaUserFromFeedUrl("https://qiita.com/saqoosha/feed")).toBe("saqoosha");
    expect(qiitaUserFromFeedUrl("https://qiita.com/saqoosha/feed/")).toBe("saqoosha");
    expect(qiitaUserFromFeedUrl("http://qiita.com/saqoosha/feed")).toBe("saqoosha");
  });

  it("returns null for non-Qiita-feed URLs", () => {
    expect(qiitaUserFromFeedUrl("https://qiita.com/saqoosha")).toBeNull();
    expect(qiitaUserFromFeedUrl("https://qiita.com/saqoosha/items/abc")).toBeNull();
    expect(qiitaUserFromFeedUrl("https://zenn.dev/saqoosha/feed")).toBeNull();
    expect(qiitaUserFromFeedUrl("https://qiita-feed.saqoosha.workers.dev/saqoosha")).toBeNull();
  });
});

describe("fetchQiitaItems", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps Qiita API items to RawItems", async () => {
    const mockResponse = [
      {
        title: "Hello",
        url: "https://qiita.com/alice/items/abc",
        created_at: "2026-01-15T10:00:00+09:00",
        body: "line1\n\nline2\n",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      })
    );

    const items = await fetchQiitaItems("alice");
    expect(items).toEqual([
      {
        title: "Hello",
        link: "https://qiita.com/alice/items/abc",
        isoDate: "2026-01-15T10:00:00+09:00",
        contentSnippet: "line1 line2",
      },
    ]);
    expect(fetch).toHaveBeenCalledWith("https://qiita.com/api/v2/users/alice/items?per_page=100");
  });

  it("throws when the Qiita API returns a non-2xx status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => null })
    );
    await expect(fetchQiitaItems("alice")).rejects.toThrow(/503/);
  });

  it("truncates contentSnippet to 200 characters", async () => {
    const longBody = "a".repeat(500);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { title: "T", url: "https://qiita.com/a/items/x", created_at: "2026-01-01T00:00:00Z", body: longBody },
        ],
      })
    );
    const [item] = await fetchQiitaItems("alice");
    expect(item.contentSnippet?.length).toBe(200);
  });
});
