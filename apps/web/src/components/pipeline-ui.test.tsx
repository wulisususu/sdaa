import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CompilerDemo } from "./compiler-demo";
import { CoverageStage } from "./coverage-stage";
import { InputStage } from "./input-stage";

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
    expect(html).not.toContain("现在转码还有前途吗？");
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
});
