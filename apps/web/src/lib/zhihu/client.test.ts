import { describe, expect, test } from "vitest";
import { searchZhihu, type ZhihuFetch } from "./client";

const successBody = {
  Code: 0,
  Message: "success",
  Data: {
    HasMore: false,
    SearchHashId: "search-1",
    Items: [
      {
        Title: "RAG 评测方法综述",
        ContentType: "Article",
        ContentID: "123456789",
        ContentText: "本文介绍主流 RAG 评测框架。",
        Url: "https://zhuanlan.zhihu.com/p/123456789?utm_medium=openapi_platform",
        CommentCount: 15,
        VoteUpCount: 128,
        AuthorName: "张三",
        AuthorAvatar: "https://picx.zhimg.com/example.jpg",
        AuthorBadge: "",
        AuthorBadgeText: "",
        EditTime: 1710000000,
        CommentInfoList: [{ Content: "很有帮助" }],
        AuthorityLevel: "2",
        RankingScore: 0.98
      }
    ]
  }
};

describe("searchZhihu", () => {
  test("uses the official HTTP protocol and caps Count at ten", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    const fakeFetch: ZhihuFetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(JSON.stringify(successBody), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };

    const result = await searchZhihu("RAG 评测", {
      count: 99,
      fetchImpl: fakeFetch,
      now: () => 1_710_000_123_456,
      env: { ZHIHU_ACCESS_SECRET: "secret-for-test" }
    });

    const url = new URL(capturedUrl);
    const headers = new Headers(capturedInit?.headers);

    expect(`${url.origin}${url.pathname}`).toBe(
      "https://developer.zhihu.com/api/v1/content/zhihu_search"
    );
    expect(url.searchParams.get("Query")).toBe("RAG 评测");
    expect(url.searchParams.get("Count")).toBe("10");
    expect(headers.get("Authorization")).toBe("Bearer secret-for-test");
    expect(headers.get("X-Request-Timestamp")).toBe("1710000123");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(result.Items).toHaveLength(1);
  });

  test.each([
    [20001, "ZHIHU_UNAUTHORIZED", false],
    [30001, "ZHIHU_RATE_LIMITED", true]
  ])("maps Zhihu business code %s safely", async (Code, expectedCode, retryable) => {
    const fakeFetch: ZhihuFetch = async () =>
      new Response(JSON.stringify({ Code, Message: "upstream detail", Data: null }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });

    await expect(
      searchZhihu("测试查询", {
        fetchImpl: fakeFetch,
        env: { ZHIHU_ACCESS_SECRET: "secret-for-test" }
      })
    ).rejects.toMatchObject({ code: expectedCode, retryable });
  });

  test("maps an HTTP 5xx to a safe upstream error", async () => {
    const fakeFetch: ZhihuFetch = async () => new Response("internal detail", { status: 503 });

    await expect(
      searchZhihu("测试查询", {
        fetchImpl: fakeFetch,
        env: { ZHIHU_ACCESS_SECRET: "secret-for-test" }
      })
    ).rejects.toMatchObject({ code: "ZHIHU_UPSTREAM_ERROR", retryable: true });
  });
});
