import { describe, expect, test } from "vitest";
import type { QuestionAnalysis } from "@ask-better/domain";
import { analyzeQuestion, type StructuredGenerator } from "./analyze-service";

const analysisFixture: QuestionAnalysis = {
  intent: ["职业转换"],
  primaryGoal: "判断是否值得转向开发岗位",
  timeSensitive: true,
  ambiguities: ["转码方向未知"],
  missingContext: [{ field: "direction", reason: "方向会改变答案", priority: 1 }],
  clarificationQuestions: [
    {
      id: "direction",
      question: "更想转向哪类岗位？",
      options: ["AI 应用开发", "前后端", "暂不确定"]
    },
    {
      id: "goal",
      question: "最关心什么？",
      options: ["就业", "薪资", "成长"]
    }
  ],
  diagnostics: [
    {
      code: "W001",
      title: "范围太大",
      summary: "需要明确转码方向",
      level: "warning"
    }
  ]
};

describe("analyzeQuestion", () => {
  test("forwards the exact raw question and returns only validated model data", async () => {
    const rawQuestion = "我最近在考虑转码，这条路现在还值得走吗？";
    let seenPrompt = "";

    const fakeGenerate = (async (_schema, _system, prompt) => {
      seenPrompt = prompt;
      return analysisFixture;
    }) as StructuredGenerator;

    const result = await analyzeQuestion(rawQuestion, { generateStructured: fakeGenerate });

    expect(seenPrompt).toContain(rawQuestion);
    expect(result).toEqual(analysisFixture);
    expect(result).not.toHaveProperty("background");
  });

  test("rejects an invalid structured result from an injected generator", async () => {
    const fakeGenerate = (async () => ({
      intent: [],
      primaryGoal: "",
      timeSensitive: false,
      ambiguities: [],
      missingContext: [],
      clarificationQuestions: [],
      diagnostics: []
    })) as StructuredGenerator;

    await expect(
      analyzeQuestion("这是一个足够长的测试问题吗？", { generateStructured: fakeGenerate })
    ).rejects.toMatchObject({
      code: "AI_INVALID_OUTPUT",
      retryable: true
    });
  });
});
