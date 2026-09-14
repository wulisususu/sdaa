import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ClarificationStage, findFirstUnansweredIndex } from "./clarification-stage";
import { CompiledQuestionPanel } from "./compiled-question-panel";
import { CompilerDemo } from "./compiler-demo";
import { CoverageStage } from "./coverage-stage";
import { DiagnosisStage } from "./diagnosis-stage";
import {
  EvidenceDrawerContent,
  getInitialFocusIndex,
  getTrappedFocusIndex
} from "./evidence-drawer";
import { InputStage } from "./input-stage";
import { KnowledgeCoverage } from "./knowledge-coverage";

function makeEvidence(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1),
    title: `证据 ${index + 1}`,
    contentType: "Question",
    summary: `摘要 ${index + 1}`,
    url: `https://www.zhihu.com/question/${index + 1}`,
    author: "答主",
    editedAt: 1710000000 + index,
    rankingScore: 0.9,
    authorityLevel: "2",
    voteUpCount: 10 + index,
    commentCount: index,
    selectedComments: [],
    source: "zhihu" as const
  }));
}

const evidence = makeEvidence(1);

const compiledQuestion = {
  title: "内部 IR 标题",
  background: "希望建立可执行的学习路径。",
  goal: "形成求职能力。",
  constraints: ["每周 10 小时"],
  coreUncertainty: "学习顺序如何安排？",
  expectedAnswer: ["阶段路线", "能力标准"]
};

const publishableQuestion = {
  title: "每周能投入 10 小时，AI 应用开发应该怎么系统学习？",
  context: "我想以求职为目标学习 AI 应用开发，每周能投入 10 小时，希望得到一条可执行的路线。",
  questions: ["应该先学哪些基础？", "每个阶段达到什么程度再继续？"]
};

describe("real pipeline UI", () => {
  test("initial compiler is an empty input scene with retired chrome removed", () => {
    const html = renderToStaticMarkup(<CompilerDemo />);

    expect(html).toContain('data-stage="input"');
    expect(html).toContain("01 / 05 · INPUT");
    expect(html).not.toContain("Mock Data");
    expect(html).not.toContain('class="page-intro"');
    expect(html).not.toContain('class="demo-badge"');
    expect(html).not.toContain("stage-stepper");
    expect(html).not.toContain("mobile-stage-progress");
    expect(html).not.toContain("真实链路 · AI + 知乎检索");
    expect(html).not.toContain("真实 AI + 知乎检索");
  });

  test("compiler routes the active stage through the transition viewport", () => {
    const html = renderToStaticMarkup(<CompilerDemo />);
    expect(html).toContain("scene-transition-viewport");
    expect(html).not.toContain("stage-scene-shell");
  });

  test("input keeps loading feedback and explicit headline motion", () => {
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
    expect(html).toContain('<h2 data-motion="headline">你真正想问什么？</h2>');
    expect(html).toContain('data-motion="primary-action"');
    expect(html).not.toContain("不会自动发布");
  });

  test("clarify focuses the first unanswered question and renders one card", () => {
    const questions = [
      { id: "q1", question: "第一题？", options: ["A"] },
      { id: "q2", question: "第二题？", options: ["B"] }
    ];

    expect(findFirstUnansweredIndex(questions, { q1: "A" })).toBe(1);

    const html = renderToStaticMarkup(
      <ClarificationStage
        questions={questions}
        answers={{}}
        answeredCount={0}
        onAnswer={() => undefined}
        onBack={() => undefined}
        onContinue={() => undefined}
      />
    );

    expect(html).toContain("第一题？");
    expect(html).not.toContain("clarification-grid");
    expect(html).toContain("1 / 2");
  });

  test("clarification selection has a non-color check indicator", () => {
    const html = renderToStaticMarkup(
      <ClarificationStage
        questions={[{ id: "q1", question: "你的主要目标是什么？", options: ["求职", "学习"] }]}
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

  test("diagnostics expose severity as text", () => {
    const html = renderToStaticMarkup(
      <DiagnosisStage
        rawQuestion="现在转码还有前途吗？"
        intent={["判断职业方向"]}
        diagnostics={[{ code: "W001", title: "范围过宽", summary: "需要进一步限定方向。", level: "high" }]}
        onBack={() => undefined}
        onContinue={() => undefined}
      />
    );

    expect(html).toContain("高优先级");
    expect(html).toContain('data-motion-item="diagnostic"');
  });

  test("coverage renders real evidence and limits the main preview to four", () => {
    const stage = renderToStaticMarkup(
      <CoverageStage
        coverage={[]}
        gaps={[]}
        evidence={evidence}
        status="success"
        onBack={() => undefined}
        onContinue={() => undefined}
      />
    );
    expect(stage).toContain("已基于知乎检索结果分析");
    expect(stage).toContain('target="_blank"');

    const card = renderToStaticMarkup(<KnowledgeCoverage items={[]} evidence={makeEvidence(6)} />);
    expect(card).toContain("查看全部 6 条参考来源");
    expect((card.match(/data-evidence-preview=/g) ?? []).length).toBe(4);
  });

  test("coverage exposes compile loading feedback", () => {
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

  test("evidence drawer exposes modal semantics and deterministic focus rules", () => {
    const html = renderToStaticMarkup(
      <EvidenceDrawerContent items={makeEvidence(2)} onClose={() => undefined} />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="全部参考来源"');
    expect(getInitialFocusIndex(7)).toBe(0);
    expect(getTrappedFocusIndex(3, 2, false)).toBe(0);
    expect(getTrappedFocusIndex(3, 0, true)).toBe(2);
  });

  test("result prioritizes publishable content and uses concise icon-led actions", () => {
    const html = renderToStaticMarkup(
      <CompiledQuestionPanel
        question={compiledQuestion}
        publishableQuestion={publishableQuestion}
        copyStatus="copied"
      />
    );

    expect(html).toContain("知乎可发布版本");
    expect(html).toContain(publishableQuestion.title);
    expect(html).toContain("查看编译细节");
    expect(html).toContain("Question IR");
    expect(html).toContain(">已复制</button>");
    expect(html).toContain('data-icon="check"');
    expect(html).toContain(">打开知乎</button>");
    expect(html).toContain(">继续优化</button>");
    expect(html).toContain(">新问题</button>");
    expect(html).not.toContain("复制后前往知乎发起提问");
  });

  test("copy failure uses concise retry feedback", () => {
    const html = renderToStaticMarkup(
      <CompiledQuestionPanel
        question={compiledQuestion}
        publishableQuestion={publishableQuestion}
        copyStatus="error"
      />
    );

    expect(html).toContain(">重试</button>");
    expect(html).toContain('data-icon="retry"');
    expect(html).not.toContain("复制失败，请重试");
  });
});
