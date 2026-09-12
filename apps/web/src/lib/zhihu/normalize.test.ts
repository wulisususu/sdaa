import { describe, expect, test } from "vitest";
import { normalizeZhihuSearchItem } from "./normalize";

describe("normalizeZhihuSearchItem", () => {
  test("converts official Zhihu fields into the shared evidence model", () => {
    const result = normalizeZhihuSearchItem({
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
    });

    expect(result).toEqual({
      id: "123456789",
      title: "RAG 评测方法综述",
      contentType: "Article",
      summary: "本文介绍主流 RAG 评测框架。",
      url: "https://zhuanlan.zhihu.com/p/123456789?utm_medium=openapi_platform",
      author: "张三",
      editedAt: 1710000000,
      rankingScore: 0.98,
      authorityLevel: "2",
      voteUpCount: 128,
      commentCount: 15,
      selectedComments: ["很有帮助"],
      source: "zhihu"
    });
  });

  test("uses an empty selected-comments array when the field is absent", () => {
    const result = normalizeZhihuSearchItem({
      Title: "一个问题",
      ContentType: "Question",
      ContentID: "q-1",
      ContentText: "摘要",
      Url: "https://www.zhihu.com/question/1?utm_medium=openapi_platform",
      CommentCount: 0,
      VoteUpCount: 0,
      AuthorName: "作者",
      AuthorAvatar: "",
      AuthorBadge: "",
      AuthorBadgeText: "",
      EditTime: 1710000000,
      AuthorityLevel: "0",
      RankingScore: 0.5
    });

    expect(result.selectedComments).toEqual([]);
  });
});
