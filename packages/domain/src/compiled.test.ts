import { describe, expect, test } from "vitest";
import type { CompiledQuestion, PublishableQuestion } from "./question";
import { formatCompiledQuestion, formatPublishableQuestion } from "./compiled";

const question: CompiledQuestion = {
  title: "27 届学生如何选择 AI 应用开发与传统前后端？",
  background: "非计算机专业本科生，准备毕业求职。",
  goal: "选择一条更适合投入的技术路线。",
  constraints: ["6 个月", "关注初级岗位"],
  coreUncertainty: "先补 Web 基础还是直接学习 AI 应用开发？",
  expectedAnswer: ["招聘环境", "学习顺序"]
};

const publishable: PublishableQuestion = {
  title: "想转码时，AI 应用开发和传统前后端该怎么选？",
  context: "我正在评估转码方向，目前最关心初级岗位机会和实际学习投入。",
  questions: ["两条路线的初级岗位机会有什么差异？", "学习顺序和项目门槛分别如何？"]
};

describe("compiled question formatters", () => {
  test("retains the complete IR formatter for internal explainability", () => {
    const output = formatCompiledQuestion(question);
    expect(output).toContain(question.title);
    expect(output).toContain("背景：非计算机专业本科生，准备毕业求职。");
    expect(output).toContain("目标：选择一条更适合投入的技术路线。");
    expect(output).toContain("限制：6 个月；关注初级岗位");
    expect(output).toContain("真正困惑：先补 Web 基础还是直接学习 AI 应用开发？");
    expect(output).toContain("希望回答重点：招聘环境；学习顺序");
  });

  test("formats only the human-facing publishable question for clipboard use", () => {
    const output = formatPublishableQuestion(publishable);
    expect(output).toContain(publishable.title);
    expect(output).toContain(publishable.context);
    expect(output).toContain("想请教：");
    expect(output).toContain("- 两条路线的初级岗位机会有什么差异？");
    expect(output).not.toContain("背景：");
    expect(output).not.toContain("目标：");
    expect(output).not.toContain("限制：");
    expect(output).not.toContain("真正困惑：");
    expect(output).not.toContain("希望回答重点：");
  });
});
