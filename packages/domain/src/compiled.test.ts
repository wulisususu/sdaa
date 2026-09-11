import { describe, expect, test } from "vitest";
import type { CompiledQuestion } from "./question";
import { formatCompiledQuestion } from "./compiled";

const question: CompiledQuestion = {
  title: "27 届学生如何选择 AI 应用开发与传统前后端？",
  background: "非计算机专业本科生，准备毕业求职。",
  goal: "选择一条更适合投入的技术路线。",
  constraints: ["6 个月", "关注初级岗位"],
  coreUncertainty: "先补 Web 基础还是直接学习 AI 应用开发？",
  expectedAnswer: ["招聘环境", "学习顺序"]
};

describe("formatCompiledQuestion", () => {
  test("formats the complete question package for copying", () => {
    const output = formatCompiledQuestion(question);

    expect(output).toContain(question.title);
    expect(output).toContain("背景：非计算机专业本科生，准备毕业求职。");
    expect(output).toContain("目标：选择一条更适合投入的技术路线。");
    expect(output).toContain("限制：6 个月；关注初级岗位");
    expect(output).toContain("真正困惑：先补 Web 基础还是直接学习 AI 应用开发？");
    expect(output).toContain("希望回答重点：招聘环境；学习顺序");
  });
});
