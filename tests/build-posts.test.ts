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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function jsonResponse(body: unknown, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }

  it("maps Qiita API items to RawItems and prefers rendered_body for snippets", async () => {
    const mockResponse = [
      {
        title: "Hello",
        url: "https://qiita.com/alice/items/abc",
        created_at: "2026-01-15T10:00:00+09:00",
        body: "raw markdown [link](https://x.test) text",
        rendered_body: "<p>rendered <a href=\"https://x.test\">link</a> text</p>",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(mockResponse));
    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchQiitaItems("alice");
    expect(items).toEqual([
      {
        title: "Hello",
        link: "https://qiita.com/alice/items/abc",
        isoDate: "2026-01-15T10:00:00+09:00",
        contentSnippet: "rendered link text",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://qiita.com/api/v2/users/alice/items?per_page=100&page=1"
    );
  });

  it("falls back to body when rendered_body is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse([
          { title: "T", url: "https://qiita.com/a/items/x", created_at: "2026-01-01T00:00:00Z", body: "fallback\nbody" },
        ])
      )
    );
    const [item] = await fetchQiitaItems("alice");
    expect(item.contentSnippet).toBe("fallback body");
  });

  it("throws when the Qiita API returns a non-2xx status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(null, 503))
    );
    await expect(fetchQiitaItems("alice")).rejects.toThrow(/503/);
  });

  it("propagates fetch network errors so fetchMember records them in failed[]", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(fetchQiitaItems("alice")).rejects.toThrow(/fetch failed/);
  });

  it("throws when the API returns 200 with a non-array body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "rate limited" })));
    await expect(fetchQiitaItems("alice")).rejects.toThrow(/non-array/);
  });

  it("passes through items with missing created_at so normalizeFeedItem can drop them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse([
          { title: "no date", url: "https://qiita.com/a/items/y", body: "x" },
        ])
      )
    );
    const items = await fetchQiitaItems("alice");
    expect(items).toEqual([
      { title: "no date", link: "https://qiita.com/a/items/y", isoDate: undefined, contentSnippet: "x" },
    ]);
    expect(normalizeFeedItem(items[0], "a", "A")).toBeNull();
  });

  it("paginates until a page returns fewer than per_page items", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      title: `t${i}`,
      url: `https://qiita.com/a/items/${i}`,
      created_at: "2026-01-01T00:00:00Z",
      body: "b",
    }));
    const page2 = [
      { title: "tail", url: "https://qiita.com/a/items/tail", created_at: "2025-12-31T00:00:00Z", body: "b" },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2));
    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchQiitaItems("alice");
    expect(items).toHaveLength(101);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("page=1");
    expect(fetchMock.mock.calls[1][0]).toContain("page=2");
  });

  it("warns when 0 items are returned", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    const items = await fetchQiitaItems("ghost");
    expect(items).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Qiita user "ghost" returned 0 items'));
  });

  it("truncates contentSnippet to 200 characters", async () => {
    const longBody = "a".repeat(500);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse([
          { title: "T", url: "https://qiita.com/a/items/x", created_at: "2026-01-01T00:00:00Z", body: longBody },
        ])
      )
    );
    const [item] = await fetchQiitaItems("alice");
    expect(item.contentSnippet?.length).toBe(200);
  });

  it("sets an AbortSignal so the build cannot hang on Qiita", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchQiitaItems("alice");
    const options = fetchMock.mock.calls[0][1];
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });
});
