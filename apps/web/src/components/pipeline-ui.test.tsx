import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ClarificationStage } from "./clarification-stage";
import { CompiledQuestionPanel } from "./compiled-question-panel";
import { CompilerDemo } from "./compiler-demo";
import { CoverageStage } from "./coverage-stage";
import { DiagnosisStage } from "./diagnosis-stage";
import { InputStage } from "./input-stage";
import { StageStepper } from "./stage-stepper";

const evidence = [{
  id: "123",
  title: "AI 应用开发就业前景如何？",
  contentType: "Question",
  summary: "讨论 AI 应用开发岗位与能力要求。",
  url: "https://www.zhihu.com/question/123",
  author: "答主",
  editedAt: 1710000000,
  rankingScore: 0.95,
  authorityLevel: "2",
  voteUpCount: 88,
  commentCount: 12,
  selectedComments: [],
  source: "zhihu" as const
}];

describe("real pipeline UI", () => {
  test("initial compiler no longer presents mock data", () => {
    const html = renderToStaticMarkup(<CompilerDemo />);
    expect(html).not.toContain("Mock Data");
    expect(html).not.toContain(">现在转码还有前途吗？</textarea>");
  });

  test("input stage exposes the analyze loading state", () => {
    const html = renderToStaticMarkup(
      <InputStage
        rawQuestion="AI 应用开发应该怎么学？"
        ready
        loading
        onChange={() => undefined}
        onContinue={() => undefined}
      />
    );
    expect(html).toContain("正在理解你的问题…");
  });

  test("input stage explains the evidence and publishing boundary", () => {
    const html = renderToStaticMarkup(
      <InputStage
        rawQuestion="AI 应用开发应该怎么学？"
        ready
        onChange={() => undefined}
        onContinue={() => undefined}
      />
    );
    expect(html).toContain("真实 AI + 知乎检索");
    expect(html).toContain("不会自动发布");
  });

  test("stepper marks earlier visited stages as completed", () => {
    const html = renderToStaticMarkup(
      <StageStepper stage="diagnose" maxVisited="diagnose" />
    );
    expect(html).toContain("is-completed");
    expect(html).toContain("✓");
    expect(html).toContain('aria-current="step"');
  });

  test("stepper exposes compact mobile progress instead of relying on compressed desktop labels", () => {
    const html = renderToStaticMarkup(
      <StageStepper stage="diagnose" maxVisited="diagnose" />
    );
    expect(html).toContain("mobile-stage-progress");
    expect(html).toContain("3 / 5");
    expect(html).toContain("问题体检");
  });

  test("clarification selection has a non-color check indicator", () => {
    const html = renderToStaticMarkup(
      <ClarificationStage
        questions={[{
          id: "q1",
          question: "你的主要目标是什么？",
          options: ["求职", "学习"]
        }]}
        answers={{ q1: "求职" }}
        answeredCount={1}
        onAnswer={() => undefined}
        onBack={() => undefined}
        onContinue={() => undefined}
      />
    );
    expect(html).toContain("is-answered");
    expect(html).toContain("option-check");
    expect(html).toContain("✓");
  });

  test("diagnostics render severity as text, not color alone", () => {
    const html = renderToStaticMarkup(
      <DiagnosisStage
        rawQuestion="现在转码还有前途吗？"
        intent={["判断职业方向"]}
        diagnostics={[{
          code: "W001",
          title: "范围过宽",
          summary: "需要进一步限定方向。",
          level: "high"
        }]}
        onBack={() => undefined}
        onContinue={() => undefined}
      />
    );
    expect(html).toContain("高优先级");
  });

  test("coverage stage renders real Zhihu evidence links and status", () => {
    const html = renderToStaticMarkup(
      <CoverageStage
        coverage={[]}
        gaps={[]}
        evidence={evidence}
        status="success"
        onBack={() => undefined}
        onContinue={() => undefined}
      />
    );
    expect(html).toContain("已基于知乎检索结果分析");
    expect(html).toContain("AI 应用开发就业前景如何？");
    expect(html).toContain('href="https://www.zhihu.com/question/123"');
    expect(html).toContain('target="_blank"');
  });

  test("coverage stage exposes real compile loading feedback", () => {
    const html = renderToStaticMarkup(
      <CoverageStage
        coverage={[]}
        gaps={[]}
        evidence={evidence}
        status="success"
        loading
        onBack={() => undefined}
        onContinue={() => undefined}
      />
    );
    expect(html).toContain("button-spinner");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("正在把信息编译成一个更清楚的问题…");
  });

  test("coverage stage never calls empty evidence a Zhihu search result", () => {
    const html = renderToStaticMarkup(
      <CoverageStage
        coverage={[]}
        gaps={[]}
        evidence={[]}
        status="unavailable"
        onBack={() => undefined}
        onContinue={() => undefined}
      />
    );
    expect(html).toContain("本次未加入知乎已有讨论证据，仍可继续整理问题");
    expect(html).not.toContain("知乎检索结果</span>");
  });

  test("copy feedback distinguishes success and error states", () => {
    const question = {
      title: "如何系统学习 AI 应用开发？",
      background: "希望建立可执行的学习路径。",
      goal: "形成求职能力。",
      constraints: ["每周 10 小时"],
      coreUncertainty: "学习顺序如何安排？",
      expectedAnswer: ["阶段路线", "能力标准"]
    };

    const copied = renderToStaticMarkup(
      <CompiledQuestionPanel question={question} copyStatus="copied" />
    );
    const failed = renderToStaticMarkup(
      <CompiledQuestionPanel question={question} copyStatus="error" />
    );

    expect(copied).toContain("✓ 已复制");
    expect(failed).toContain("复制失败，请重试");
  });
});
