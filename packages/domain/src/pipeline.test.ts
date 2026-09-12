import { describe, expect, test } from "vitest";
import {
  AnalyzeRequestSchema,
  CompileResultSchema,
  QuestionAnalysisSchema,
  RetrieveResultSchema
} from "./pipeline";

describe("pipeline contracts", () => {
  test("rejects a too-short raw question", () => {
    expect(AnalyzeRequestSchema.safeParse({ rawQuestion: "四字" }).success).toBe(false);
  });

  test("accepts two to four clarification questions when clarification is needed", () => {
    const parsed = QuestionAnalysisSchema.safeParse({
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
    });

    expect(parsed.success).toBe(true);
  });

  test("rejects more than four clarification questions", () => {
    const clarificationQuestions = Array.from({ length: 5 }, (_, index) => ({
      id: `q-${index}`,
      question: `问题 ${index}`,
      options: ["选项 A", "选项 B"]
    }));

    const parsed = QuestionAnalysisSchema.safeParse({
      intent: ["职业转换"],
      primaryGoal: "判断职业方向",
      timeSensitive: false,
      ambiguities: [],
      missingContext: [],
      clarificationQuestions,
      diagnostics: []
    });

    expect(parsed.success).toBe(false);
  });

  test("retrieval result distinguishes evidence status", () => {
    const parsed = RetrieveResultSchema.safeParse({
      status: "success",
      evidenceStatus: "sufficient",
      queries: ["非科班 转码"],
      evidence: [],
      existingCoverage: [],
      knowledgeGaps: []
    });

    expect(parsed.success).toBe(true);
  });

  test("compiled result uses the existing question package shape", () => {
    const parsed = CompileResultSchema.safeParse({
      compiledQuestion: {
        title: "非计算机专业学生如何判断是否值得转向 AI 应用开发？",
        background: "用户正在评估职业方向。",
        goal: "选择值得投入的路线。",
        constraints: ["关注初级岗位"],
        coreUncertainty: "应先补 Web 基础还是直接学习 AI 应用开发？",
        expectedAnswer: ["招聘环境", "学习顺序"]
      },
      evidenceUsed: true
    });

    expect(parsed.success).toBe(true);
  });
});
