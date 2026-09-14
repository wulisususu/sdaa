import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CoverageScrollRegion } from "./coverage-scroll-region";
import { CoverageStage } from "./coverage-stage";
import { KnowledgeCoverage } from "./knowledge-coverage";
import { KnowledgeGap } from "./knowledge-gap";

const moduleCss = readFileSync(new URL("./coverage-stage.module.css", import.meta.url), "utf8");
const globalsCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

/** Full text of one `@media <condition>{...}` block, with braces balanced. */
function mediaBlock(css: string, condition: string): string {
  const start = css.indexOf(`@media ${condition}{`);
  expect(start, `media block not found: ${condition}`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = start; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced media block: ${condition}`);
}

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

  test("right knowledge-gap card owns its own scroll region", () => {
    const html = renderToStaticMarkup(
      <KnowledgeGap
        items={[
          {
            id: "gap-1",
            title: "仍值得追问",
            detail: "当前检索没有覆盖这个细节"
          }
        ]}
      />
    );

    expect(html).toContain('aria-label="还值得继续问什么"');
    expect(html).toContain("仍值得追问");
    expect((html.match(/data-coverage-scroll-region=/g) ?? []).length).toBe(1);
  });

  test("coverage renders a bounded grid and stage-wide footer", () => {
    const html = renderToStaticMarkup(
      <CoverageStage
        coverage={[]}
        gaps={[]}
        evidence={[]}
        status="success"
        onBack={() => undefined}
        onContinue={() => undefined}
      />
    );

    expect(html).toContain('data-coverage-stage="true"');
    expect(html).toContain('data-coverage-grid="true"');
    expect(html).toContain('data-coverage-footer="true"');
    expect(html).toContain("返回问题体检");
    expect(html).toContain("编译我的问题");
  });
});

/**
 * The bounded one-viewport layout rests on two declarations that jsdom cannot observe (it has no
 * layout engine), so they are pinned at the source level. Both were wrong in the first
 * implementation and the consequence was severe rather than cosmetic: with production-shaped
 * retrieval data the Coverage scene grew to 1096px inside an 828px canvas and the primary CTA sat
 * 263px below the fold with no way to reach it.
 */
describe("Coverage one-viewport geometry contract", () => {
  test("the bounded layout declares a definite grid row on the safe frame", () => {
    // globals.css lays .scene-safe-frame out as `display: grid; grid-template-rows: min-content`,
    // and a min-content row is indefinite — so `height: 100%` on .scene-content silently resolves
    // to `auto` and the whole percentage chain below it collapses. Only a definite row fixes it.
    const block = mediaBlock(moduleCss, "(min-width: 1024px)");
    const frameRule = block.match(
      /:global\(\.scene-canvas\[data-stage="coverage"\] \.scene-safe-frame\)\{([^}]*)\}/
    );

    expect(frameRule).not.toBeNull();
    expect(frameRule?.[1]).toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\)/);
    expect(frameRule?.[1]).toMatch(/height:\s*100%/);
    expect(frameRule?.[1]).toMatch(/min-height:\s*0/);
    expect(block).toMatch(
      /:global\(\.scene-canvas\[data-stage="coverage"\] \.scene-content\)\{[^}]*height:\s*100%/
    );
  });

  test("the bounded layout starts at 1024px and pins the two-column grid there", () => {
    // 1024x768 is the narrowest desktop size the stage must keep to one viewport, so the bound is
    // fixed by that requirement rather than by a convenient breakpoint.
    expect(moduleCss).toContain("@media (min-width: 1024px){");

    // globals.css still collapses .knowledge-grid to one column below 1280px. Inside the bounded
    // box that would stack the two cards and shrink each internal scroll window to ~160px, so the
    // coverage stage must pin the desktop columns for itself — and that collapse range must still
    // cover 1024px, otherwise this override has become dead weight and should be removed.
    const collapseCondition = globalsCss
      .match(/@media \(min-width: 768px\) and \(max-width: \d+px\)/)![0]
      .replace("@media ", "");
    const collapseBlock = mediaBlock(globalsCss, collapseCondition);
    const collapseUpperBound = Number(collapseCondition.match(/max-width: (\d+)px/)![1]);

    expect(collapseBlock).toMatch(/\.knowledge-grid[\s\S]*?grid-template-columns:\s*1fr/);
    expect(1024).toBeLessThanOrEqual(collapseUpperBound);
    expect(collapseUpperBound).toBeLessThan(1280);

    expect(mediaBlock(moduleCss, "(min-width: 1024px)")).toMatch(
      /\.coverageGrid\{[^}]*grid-template-columns:\s*minmax\([^)]*\)\s*minmax\([^)]*\)\s*!important/
    );
  });

  test("the coverage scene leaves canvas overflow scrollable as a fallback", () => {
    // Forcing `overflow-y: hidden` is what turned a geometry regression into an unreachable CTA.
    // Measured overflow is 0 at every desktop size, so `auto` shows no scrollbar while keeping a
    // scrollable worst case. Never re-add a hidden-overflow override here.
    expect(mediaBlock(moduleCss, "(min-width: 1024px)")).not.toMatch(/overflow(-y)?:\s*hidden/);
  });
});

describe("Coverage keyboard contract", () => {
  test("keyboard scrolling uses the native scroll container, never a global key listener", () => {
    // The plan forbids document/window-level keydown listeners for keyboard scrolling: a focused
    // overflow container already gets Arrow/Page/Home/End from the browser for free, and a global
    // listener would additionally steal those keys from the rest of the app. Verified in a browser:
    // ArrowDown/ArrowUp, PageDown/PageUp, End (-> max) and Home (-> 0) all work on both regions
    // after Tab focus and after a plain click on non-focusable content inside a region.
    const source = readFileSync(new URL("./coverage-scroll-region.tsx", import.meta.url), "utf8");
    // Comments are stripped first so a comment *mentioning* keydown does not trip the guard.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    expect(code).not.toMatch(/keydown|onKeyDown|onKeyUp|onKeyPress/i);
    expect(code).not.toMatch(/addEventListener\(\s*["'`]key/);
    // Native keyboard scrolling only works because the region is reachable by Tab.
    expect(source).toMatch(/tabIndex=\{0\}/);
    expect(source).toMatch(/aria-label=\{ariaLabel\}/);
  });
});
