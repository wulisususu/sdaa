import type { QuestionAnalysis } from "@ask-better/domain";
import { describe, expect, test } from "vitest";
import { MemoryCache } from "../cache/memory-cache";
import type { ZhihuRawSearchData } from "../zhihu/client";
import type { StructuredGenerator } from "./analyze-service";
import { retrieveQuestion } from "./retrieve-service";

const analysis: QuestionAnalysis = {
  intent: ["职业转换"],
  primaryGoal: "比较技术路线",
  timeSensitive: true,
  ambiguities: [],
  missingContext: [],
  clarificationQuestions: [],
  diagnostics: []
};

const firstResult: ZhihuRawSearchData = {
  HasMore: false,
  SearchHashId: "first",
  Items: [{
    Title: "AI 应用开发路线讨论",
    ContentType: "Answer",
    ContentID: "answer-1",
    ContentText: "已有一条真实检索证据。",
    Url: "https://www.zhihu.com/question/1/answer/1",
    CommentCount: 3,
    VoteUpCount: 20,
    AuthorName: "答主",
    AuthorAvatar: "",
    AuthorBadge: "",
    AuthorBadgeText: "",
    EditTime: 1710000000,
    AuthorityLevel: "2",
    RankingScore: 0.9
  }]
};

test("preserves quota_limited when later queries hit quota after evidence was collected", async () => {
  let generationCall = 0;
  const fakeGenerate = (async () => {
    generationCall += 1;
    if (generationCall === 1) return { queries: ["AI 应用开发", "岗位趋势"] };
    return { evidenceStatus: "partial", existingCoverage: [], knowledgeGaps: [] };
  }) as StructuredGenerator;

  const result = await retrieveQuestion(
    {
      rawQuestion: "AI 应用开发现在还值得转吗？",
      analysis,
      clarificationAnswers: {}
    },
    {
      generateStructured: fakeGenerate,
      searchZhihu: async (query) => {
        if (query === "AI 应用开发") return firstResult;
        throw Object.assign(new Error("rate limited"), {
          code: "ZHIHU_RATE_LIMITED",
          retryable: true
        });
      },
      cache: new MemoryCache()
    }
  );

  expect(result.evidence).toHaveLength(1);
  expect(result.status).toBe("quota_limited");
  expect(result.warnings?.join(" ")).toContain("额度");
});
