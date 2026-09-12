import { describe, expect, test } from "vitest";
import type { CompileRequest, QuestionAnalysis, RetrieveResult } from "@ask-better/domain";
import type { StructuredGenerator } from "./analyze-service";
import { compileQuestion } from "./compile-service";

const analysis: QuestionAnalysis = {
  intent: ["职业转换"],
  primaryGoal: "比较技术路线",
  timeSensitive: true,
  ambiguities: [],
  missingContext: [],
  clarificationQuestions: [],
  diagnostics: []
};

const retrieval: RetrieveResult = {
  status: "success",
  evidenceStatus: "partial",
  queries: ["AI 应用开发 转码"],
  evidence: [
    {
      id: "answer-1",
      title: "非科班转码经验",
      contentType: "Answer",
      summary: "讨论非科班转码成本。",
      url: "https://www.zhihu.com/question/1/answer/1?utm_medium=openapi_platform",
      author: "答主",
      editedAt: 1710000000,
      rankingScore: 0.9,
      authorityLevel: "2",
      voteUpCount: 100,
      commentCount: 10,
      selectedComments: [],
      source: "zhihu"
    }
  ],
  existingCoverage: [],
  knowledgeGaps: []
};

const input: CompileRequest = {
  rawQuestion: "我想转码，但不知道 AI 应用开发还是传统前后端更适合。",
  analysis,
  clarificationAnswers: {
    direction: "AI 应用开发",
    goal: "就业机会"
  },
  retrieval
};

describe("compileQuestion", () => {
  test("passes explicit user facts and evidence separately and marks evidence as used", async () => {
    let seenPrompt = "";
    const fakeGenerate = (async (_schema, _system, prompt) => {
      seenPrompt = prompt;
      return {
        title: "想转码并关注就业机会时，AI 应用开发和传统前后端应该如何比较？",
        background: "正在评估转码方向。",
        goal: "比较 AI 应用开发和传统前后端的就业机会。",
        constraints: ["明确关注就业机会"],
        coreUncertainty: "两条路线中哪一条更适合当前投入？",
        expectedAnswer: ["初级岗位机会", "学习投入", "项目门槛"]
      };
    }) as StructuredGenerator;

    const result = await compileQuestion(input, { generateStructured: fakeGenerate });

    expect(seenPrompt).toContain(input.rawQuestion);
    expect(seenPrompt).toContain('"direction": "AI 应用开发"');
    expect(seenPrompt).toContain('"goal": "就业机会"');
    expect(seenPrompt).toContain("非科班转码经验");
    expect(result.evidenceUsed).toBe(true);
    expect(result.compiledQuestion.title).toContain("AI 应用开发");
  });

  test("does not claim evidence was used when retrieval has no evidence", async () => {
    const fakeGenerate = (async () => ({
      title: "如何判断自己是否值得转向 AI 应用开发？",
      background: "正在评估转码方向。",
      goal: "判断是否值得投入 AI 应用开发。",
      constraints: [],
      coreUncertainty: "是否值得投入这条路线？",
      expectedAnswer: ["岗位机会", "学习成本"]
    })) as StructuredGenerator;

    const result = await compileQuestion(
      {
        ...input,
        retrieval: {
          ...retrieval,
          status: "unavailable",
          evidenceStatus: "insufficient",
          evidence: []
        }
      },
      { generateStructured: fakeGenerate }
    );

    expect(result.evidenceUsed).toBe(false);
  });

  test("maps invalid generated question structure to COMPILE_FAILED", async () => {
    const fakeGenerate = (async () => ({ title: "只有标题" })) as StructuredGenerator;

    await expect(compileQuestion(input, { generateStructured: fakeGenerate })).rejects.toMatchObject({
      code: "COMPILE_FAILED",
      retryable: true
    });
  });
});
