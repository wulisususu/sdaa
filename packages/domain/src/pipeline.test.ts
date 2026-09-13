import { describe, expect, test } from "vitest";
import {
  AnalyzeRequestSchema,
  CompileResultSchema,
  CompiledQuestionSchema,
  PublishableQuestionSchema,
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
        { id: "direction", question: "更想转向哪类岗位？", options: ["AI 应用开发", "前后端", "暂不确定"] },
        { id: "goal", question: "最关心什么？", options: ["就业", "薪资", "成长"] }
      ],
      diagnostics: [{ code: "W001", title: "范围太大", summary: "需要明确转码方向", level: "warning" }]
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
      intent: ["职业转换"], primaryGoal: "判断职业方向", timeSensitive: false,
      ambiguities: [], missingContext: [], clarificationQuestions, diagnostics: []
    });
    expect(parsed.success).toBe(false);
  });

  test("retrieval result distinguishes evidence status", () => {
    const parsed = RetrieveResultSchema.safeParse({
      status: "success", evidenceStatus: "sufficient", queries: ["非科班 转码"],
      evidence: [], existingCoverage: [], knowledgeGaps: []
    });
    expect(parsed.success).toBe(true);
  });

  test("publishable question is a separate human-facing artifact", () => {
    const parsed = PublishableQuestionSchema.safeParse({
      title: "孩子大一在新一线城市上学，每月基础生活费给多少合适？",
      context: "孩子今年大一，生活费只考虑吃饭、交通、通讯和日用品，不包含娱乐、衣物和往返路费。",
      questions: ["每月多少属于节省、正常和相对宽松？", "这几项支出通常分别大概多少？"]
    });
    expect(parsed.success).toBe(true);
  });

  test("publishable question rejects scope explosion beyond four subquestions", () => {
    const parsed = PublishableQuestionSchema.safeParse({
      title: "孩子大一在新一线城市上学，每月基础生活费给多少合适？",
      context: "孩子今年大一，生活费只考虑基础开销，希望得到一个现实区间。",
      questions: ["问题一是什么？", "问题二是什么？", "问题三是什么？", "问题四是什么？", "问题五是什么？"]
    });
    expect(parsed.success).toBe(false);
  });

  test("compiled IR rejects more than four expected-answer dimensions", () => {
    const parsed = CompiledQuestionSchema.safeParse({
      title: "非计算机专业学生如何判断是否值得转向 AI 应用开发？",
      background: "正在评估职业方向。",
      goal: "选择值得投入的路线。",
      constraints: ["关注初级岗位"],
      coreUncertainty: "应先补 Web 基础还是直接学习 AI 应用开发？",
      expectedAnswer: ["一", "二", "三", "四", "五"]
    });
    expect(parsed.success).toBe(false);
  });

  test("compile result contains both IR and publishable question", () => {
    const parsed = CompileResultSchema.safeParse({
      compiledQuestion: {
        title: "非计算机专业学生如何判断是否值得转向 AI 应用开发？",
        background: "正在评估职业方向。",
        goal: "选择值得投入的路线。",
        constraints: ["关注初级岗位"],
        coreUncertainty: "应先补 Web 基础还是直接学习 AI 应用开发？",
        expectedAnswer: ["招聘环境", "学习顺序"]
      },
      publishableQuestion: {
        title: "想转码时，AI 应用开发和传统前后端该怎么选？",
        context: "我正在评估转码方向，目前最关心的是初级岗位机会和实际学习投入。",
        questions: ["两条路线的初级岗位机会有什么差异？", "学习顺序和项目门槛分别如何？"]
      },
      evidenceUsed: true
    });
    expect(parsed.success).toBe(true);
  });
});
