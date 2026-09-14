import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CoverageScrollRegion } from "./coverage-scroll-region";
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

describe("Coverage scroll regions", () => {
  test("renders a focusable, labelled native scroll region", () => {
    const html = renderToStaticMarkup(
      <CoverageScrollRegion ariaLabel="已有讨论内容">
        <p>内容</p>
      </CoverageScrollRegion>
    );

    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="已有讨论内容"');
    expect(html).toContain('data-coverage-scroll-region="true"');
  });

  test("left coverage card owns one internal scroll body for coverage and evidence", () => {
    const html = renderToStaticMarkup(
      <KnowledgeCoverage
        items={[
          {
            id: "coverage-1",
            title: "已有主题",
            detail: "已有讨论摘要",
            strength: "high"
          }
        ]}
        evidence={makeEvidence(6)}
      />
    );

    expect(html).toContain('aria-label="已有讨论与参考来源"');
    expect(html).toContain("已有主题");
    expect(html).toContain("本次参考来源");
    expect(html).toContain("查看全部 6 条参考来源");
    expect((html.match(/data-coverage-scroll-region=/g) ?? []).length).toBe(1);
  });
});
