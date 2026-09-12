import { describe, expect, test } from "vitest";
import type { QuestionAnalysis, SearchEvidenceItem } from "@ask-better/domain";
import type { StructuredGenerator } from "./analyze-service";
import { retrieveQuestion } from "./retrieve-service";
import { MemoryCache } from "../cache/memory-cache";
import { buildSearchCacheKey } from "../cache/cache";
import type { ZhihuRawSearchData } from "../zhihu/client";

const analysis: QuestionAnalysis = {
  intent: ["职业转换"],
  primaryGoal: "比较技术路线",
  timeSensitive: true,
  ambiguities: [],
  missingContext: [],
  clarificationQuestions: [],
  diagnostics: []
};

const rawItem = {
  Title: "非科班转码经验",
  ContentType: "Answer",
  ContentID: "answer-1",
  ContentText: "讨论非科班转码的学习投入。",
  Url: "https://www.zhihu.com/question/1/answer/1?utm_medium=openapi_platform",
  CommentCount: 10,
  VoteUpCount: 100,
  AuthorName: "答主",
  AuthorAvatar: "",
  AuthorBadge: "",
  AuthorBadgeText: "",
  EditTime: 1710000000,
  AuthorityLevel: "2",
  RankingScore: 0.9
};

const secondRawItem = {
  ...rawItem,
  Title: "AI 应用开发路线讨论",
  ContentID: "answer-2",
  Url: "https://www.zhihu.com/question/2/answer/2?utm_medium=openapi_platform",
  RankingScore: 0.8
};

function rawData(items: typeof rawItem[]): ZhihuRawSearchData {
  return { HasMore: false, SearchHashId: "search", Items: items };
}

describe("retrieveQuestion", () => {
  test("deduplicates query plans and evidence before coverage analysis", async () => {
    const searchCalls: string[] = [];
    let generationCall = 0;

    const fakeGenerate = (async () => {
      generationCall += 1;
      if (generationCall === 1) {
        return { queries: ["AI 应用开发", "AI 应用开发", "传统 Web"] };
      }
      return {
        evidenceStatus: "partial",
        existingCoverage: [
          {
            id: "coverage-1",
            title: "已有通用转码讨论",
            detail: "当前检索结果已经覆盖基础转码成本。",
            strength: "medium",
            evidenceIds: ["answer-1"]
          }
        ],
        knowledgeGaps: [
          {
            id: "gap-1",
            title: "AI 应用开发与传统 Web 的直接比较",
            detail: "当前检索结果较少覆盖两条路线在同一条件下的直接比较。",
            evidenceIds: ["answer-1", "answer-2"]
          }
        ]
      };
    }) as StructuredGenerator;

    const result = await retrieveQuestion(
      {
        rawQuestion: "现在转码还有前途吗？",
        analysis,
        clarificationAnswers: { direction: "AI 应用开发" }
      },
      {
        generateStructured: fakeGenerate,
        searchZhihu: async (query) => {
          searchCalls.push(query);
          return query === "AI 应用开发"
            ? rawData([rawItem, secondRawItem])
            : rawData([rawItem]);
        },
        cache: new MemoryCache()
      }
    );

    expect(searchCalls).toEqual(["AI 应用开发", "传统 Web"]);
    expect(result.queries).toEqual(["AI 应用开发", "传统 Web"]);
    expect(result.evidence.map((item) => item.id)).toEqual(["answer-1", "answer-2"]);
    expect(result.status).toBe("success");
    expect(result.evidenceStatus).toBe("partial");
    expect(result.knowledgeGaps[0]?.detail).toContain("当前检索结果较少覆盖");
  });

  test("uses cached normalized evidence instead of spending another search call", async () => {
    const cache = new MemoryCache();
    const cachedEvidence: SearchEvidenceItem[] = [
      {
        id: "cached-1",
        title: "缓存讨论",
        contentType: "Answer",
        summary: "摘要",
        url: "https://www.zhihu.com/question/3/answer/3?utm_medium=openapi_platform",
        author: "答主",
        editedAt: 1710000000,
        rankingScore: 0.7,
        authorityLevel: "1",
        voteUpCount: 20,
        commentCount: 2,
        selectedComments: [],
        source: "zhihu"
      }
    ];
    await cache.set(buildSearchCacheKey("缓存查询"), cachedEvidence, 60);

    let generationCall = 0;
    const fakeGenerate = (async () => {
      generationCall += 1;
      return generationCall === 1
        ? { queries: ["缓存查询"] }
        : { evidenceStatus: "partial", existingCoverage: [], knowledgeGaps: [] };
    }) as StructuredGenerator;

    let searchCalls = 0;
    const result = await retrieveQuestion(
      {
        rawQuestion: "这是一个用于缓存验证的完整问题？",
        analysis,
        clarificationAnswers: {}
      },
      {
        generateStructured: fakeGenerate,
        searchZhihu: async () => {
          searchCalls += 1;
          return rawData([]);
        },
        cache
      }
    );

    expect(searchCalls).toBe(0);
    expect(result.evidence[0]?.id).toBe("cached-1");
  });

  test("keeps real evidence when coverage analysis fails", async () => {
    let generationCall = 0;
    const fakeGenerate = (async () => {
      generationCall += 1;
      if (generationCall === 1) return { queries: ["AI 应用开发"] };
      throw new Error("coverage service failed");
    }) as StructuredGenerator;

    const result = await retrieveQuestion(
      {
        rawQuestion: "现在转码还有前途吗？",
        analysis,
        clarificationAnswers: {}
      },
      {
        generateStructured: fakeGenerate,
        searchZhihu: async () => rawData([rawItem]),
        cache: new MemoryCache()
      }
    );

    expect(result.status).toBe("partial");
    expect(result.evidence).toHaveLength(1);
    expect(result.existingCoverage).toEqual([]);
    expect(result.warnings?.join(" ")).toContain("覆盖分析暂时不可用");
  });

  test("returns a quota-limited partial state without fake evidence", async () => {
    const fakeGenerate = (async () => ({ queries: ["AI 应用开发"] })) as StructuredGenerator;

    const result = await retrieveQuestion(
      {
        rawQuestion: "现在转码还有前途吗？",
        analysis,
        clarificationAnswers: {}
      },
      {
        generateStructured: fakeGenerate,
        searchZhihu: async () => {
          throw Object.assign(new Error("rate limited"), {
            code: "ZHIHU_RATE_LIMITED",
            retryable: true
          });
        },
        cache: new MemoryCache()
      }
    );

    expect(result.status).toBe("quota_limited");
    expect(result.evidenceStatus).toBe("insufficient");
    expect(result.evidence).toEqual([]);
    expect(result.existingCoverage).toEqual([]);
    expect(result.knowledgeGaps).toEqual([]);
  });
});
