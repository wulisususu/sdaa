import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ResultStage } from "./result-stage";

const moduleCss = readFileSync(new URL("./result-stage.module.css", import.meta.url), "utf8");
const resultSource = readFileSync(new URL("./result-stage.tsx", import.meta.url), "utf8");
const panelSource = readFileSync(
  new URL("./compiled-question-panel.tsx", import.meta.url),
  "utf8"
);

const question = {
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

function renderResult(overrides: { evidenceUsed?: boolean; warnings?: string[] } = {}) {
  return renderToStaticMarkup(
    <ResultStage
      rawQuestion="AI 应用开发应该怎么学？"
      question={question}
      publishableQuestion={publishableQuestion}
      evidenceUsed={overrides.evidenceUsed ?? false}
      warnings={overrides.warnings ?? []}
      copyStatus="idle"
      onCopy={() => undefined}
      onReoptimize={() => undefined}
      onNewQuestion={() => undefined}
      onOpenZhihu={() => undefined}
    />
  );
}

const baselineHtml = renderResult();

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

/** Text of one rule block inside a chunk of CSS, located by its literal selector prefix. */
function ruleBlock(css: string, selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `rule not found: ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start + selector.length - 1);
  const close = css.indexOf("}", open);
  expect(open, `unbalanced rule: ${selector}`).toBeGreaterThan(open - 1);
  return css.slice(open + 1, close);
}

function countOf(html: string, needle: string): number {
  return (html.match(new RegExp(needle, "g")) ?? []).length;
}

function indexOfFirst(html: string, needle: string): number {
  const index = html.indexOf(needle);
  expect(index, `missing in markup: ${needle}`).toBeGreaterThanOrEqual(0);
  return index;
}

describe("Result unified white panel", () => {
  // U7 ---------------------------------------------------------------- deletions + survivors
  test("removed result copy is gone while the publishable result survives", () => {
    for (const removed of [
      // Prefix matching because the deleted sentence has a longer tail; a substring assert is
      // enough to prove the element is gone.
      "知乎检索结果只用于判断已有覆盖与知识缺口",
      "本次编译未使用知乎检索证据",
      "已参考本次知乎 Evidence",
      "仅基于用户提供的信息",
      "After · Publishable",
      // The compile bridge and the two-line caption were decoration that no longer exists.
      "compile-bridge",
      "before-card-caption"
    ]) {
      expect(baselineHtml, `still rendered: ${removed}`).not.toContain(removed);
    }

    // The two deleted nodes are also gone from the source, not merely hidden by CSS.
    expect(resultSource).not.toContain("result-evidence-note");
    expect(resultSource).not.toContain("result-provenance");
    expect(panelSource).not.toContain("After · Publishable");

    for (const survivor of [
      "知乎可发布版本",
      "你一开始的问题",
      "Question IR",
      "Original → Publishable",
      ">继续优化</button>",
      ">新问题</button>",
      ">打开知乎</button>",
      ">复制</button>"
    ]) {
      expect(baselineHtml, `missing: ${survivor}`).toContain(survivor);
    }
  });

  test("the evidence semantics still reach the DOM through the surviving panel badge", () => {
    // The two `evidenceUsed` render sites that were deleted were the provenance chip and the
    // evidence note. The badge in the compiled panel carries the same meaning now, so removing the
    // prop entirely would silently drop real information.
    expect(renderResult({ evidenceUsed: true })).toContain("Evidence-assisted");
    expect(renderResult({ evidenceUsed: false })).toContain("User context only");
  });

  // U8 ------------------------------------------------------- one panel, all regions inside it
  test("every result region is a descendant of the single white panel", () => {
    expect(countOf(baselineHtml, 'data-result-panel="true"')).toBe(1);

    const panelOpen = indexOfFirst(baselineHtml, 'data-result-panel="true"');
    // The panel is the outermost surface: the stage hook must come before it.
    expect(indexOfFirst(baselineHtml, 'data-result-stage="true"')).toBeLessThan(panelOpen);

    for (const hook of [
      'data-result-heading="true"',
      'data-result-status="true"',
      'data-result-comparison="true"',
      'data-result-scroll-region="true"',
      'data-result-footer="true"'
    ]) {
      const index = indexOfFirst(baselineHtml, hook);
      expect(index, `${hook} must sit inside the panel`).toBeGreaterThan(panelOpen);
    }

    // Warnings render conditionally, so they need their own render and the same containment rule.
    const warned = renderResult({ warnings: ["w1", "w2"] });
    const warnedPanel = indexOfFirst(warned, 'data-result-panel="true"');
    expect(countOf(warned, 'data-result-warnings="true"')).toBe(1);
    expect(indexOfFirst(warned, 'data-result-warnings="true"')).toBeGreaterThan(warnedPanel);
    expect(warned).toContain("w1");
    expect(warned).toContain("w2");
  });

  test("the panel no longer contains a compile bridge or a second card surface", () => {
    // A second `flow-card`/`workspace-panel` inside the stage would paint card chrome inside the
    // white panel — the "card inside card" the unified surface is meant to remove.
    expect(countOf(baselineHtml, 'class="[^"]*flow-card')).toBe(1);
    expect(baselineHtml).not.toContain('class="workspace-panel');
  });

  // U9 -------------------------------------------------------- comparison: two columns, one rule
  test("the comparison has exactly one original and one publishable column", () => {
    expect(countOf(baselineHtml, 'data-result-comparison="true"')).toBe(1);

    const comparisonOpen = indexOfFirst(baselineHtml, 'data-result-comparison="true"');
    expect(countOf(baselineHtml, 'data-result-original="true"')).toBe(1);
    expect(countOf(baselineHtml, 'data-result-publishable="true"')).toBe(1);
    expect(indexOfFirst(baselineHtml, 'data-result-original="true"')).toBeGreaterThan(comparisonOpen);
    expect(indexOfFirst(baselineHtml, 'data-result-publishable="true"')).toBeGreaterThan(
      comparisonOpen
    );

    // Both columns carry the motion hooks the pipeline depends on.
    expect(countOf(baselineHtml, 'data-motion="before"')).toBe(1);
    expect(countOf(baselineHtml, 'data-motion="after"')).toBe(1);
  });

  test("the divider is a CSS rule, vertical on desktop and horizontal below it", () => {
    // A real divider element would need its own grid column, which is exactly the 62px middle
    // column that made the Result look like two cards with a bridge between them.
    expect(baselineHtml).not.toContain("data-result-divider");

    const desktop = mediaBlock(moduleCss, "(min-width: 1024px)");
    // Vertical rule: a 1px pseudo-element pinned to the left edge of the publishable column.
    const dividerRule = desktop.match(
      /:global\(\.scene-canvas\[data-stage="result"\]\)[^{]*\.publishColumn::before\{([^}]*)\}/
    );
    expect(dividerRule, "no desktop vertical divider rule").not.toBeNull();
    expect(dividerRule?.[1]).toMatch(/width:\s*1px/);
    expect(dividerRule?.[1]).toMatch(/inset-block:\s*0/);
    expect(dividerRule?.[1]).toMatch(/background:\s*var\(--border\)/);

    // Below 1024px the columns stack and the same separation becomes a horizontal border, so the
    // divider may only exist inside the desktop media block.
    const stacked = mediaBlock(moduleCss, "(max-width: 1023px)");
    const horizontalRule = stacked.match(
      /:global\(\.scene-canvas\[data-stage="result"\]\)[^{]*\.publishColumn\{([^}]*)\}/
    );
    expect(horizontalRule, "no stacked divider rule").not.toBeNull();
    expect(horizontalRule?.[1]).toMatch(/border-top:\s*1px solid var\(--border\)/);
    expect(moduleCss.indexOf("publishColumn::before")).toBeGreaterThan(
      moduleCss.indexOf("@media (min-width: 1024px){")
    );
  });

  // U10 ------------------------------------------------------- exactly one focusable scroll owner
  test("the scroll region is focusable, labelled, and inside the panel", () => {
    const region = baselineHtml.match(/<[^>]*data-result-scroll-region="true"[^>]*>/);
    expect(region, "no scroll region rendered").not.toBeNull();
    const tag = region![0];

    expect(tag).toContain('tabindex="0"');
    expect(tag).toMatch(/aria-label="[^"]+"/);
    expect(
      indexOfFirst(baselineHtml, 'data-result-scroll-region="true"')
    ).toBeGreaterThan(indexOfFirst(baselineHtml, 'data-result-panel="true"'));

    // Keyboard scrolling relies on a native overflow container, so there must be exactly one
    // region claiming tab focus for that purpose, not a stack of nested focusable scrollers.
    expect(countOf(baselineHtml, 'tabindex="0"')).toBe(2);
  });

  test("the module hides the scrollbar chrome it replaced and keeps a focus ring", () => {
    const desktop = mediaBlock(moduleCss, "(min-width: 1024px)");

    const scrollOwner = desktop.match(
      /\.publishColumn\{([^}]*)\}/
    );
    expect(scrollOwner, "the publishable column is not the scroll owner").not.toBeNull();
    expect(scrollOwner?.[1]).toMatch(/overflow-y:\s*auto/);
    expect(scrollOwner?.[1]).toMatch(/scrollbar-width:\s*none/);
    expect(scrollOwner?.[1]).toMatch(/-ms-overflow-style:\s*none/);
    expect(scrollOwner?.[1]).toMatch(/flex:\s*1 1 auto/);
    expect(scrollOwner?.[1]).toMatch(/min-height:\s*0/);

    // `::-webkit-scrollbar{display:none}` is what actually hides the bar in Chromium, and a bare
    // `toContain` would also pass on a rule buried in a different media block.
    const webkit = ruleBlock(desktop, "::-webkit-scrollbar{");
    expect(webkit).toMatch(/width:\s*0/);
    expect(webkit).toMatch(/height:\s*0/);
    expect(webkit).toMatch(/display:\s*none/);

    const focus = ruleBlock(desktop, ":focus-visible{");
    expect(focus).toMatch(/outline:\s*2px solid var\(--focus-ring\)/);
    expect(focus).toMatch(/outline-offset:\s*-2px/);
  });

  test("the inner peep-hole no longer competes with the scroll owner", () => {
    // globals.css caps `.compiled-publishable-scroll` at `min(46dvh, 430px)`, which is a *viewport*
    // budget: inside a bounded panel it overflows the panel before it scrolls, giving two visible
    // scrollbars. Inside the result stage scoped to >=1024px it must be neutralised.
    const desktop = mediaBlock(moduleCss, "(min-width: 1024px)");
    const peepHole = desktop.match(
      /:global\(\.scene-canvas\[data-stage="result"\] \.compiled-publishable-scroll\)\{([^}]*)\}/
    );
    expect(peepHole, "the peek-hole height budget is still in force").not.toBeNull();
    expect(peepHole?.[1]).toMatch(/max-height:\s*none/);
    expect(peepHole?.[1]).toMatch(/overflow:\s*visible/);
  });

  test("result sources never bind a key listener for scrolling", () => {
    // A focused overflow container already receives Arrow/Page/Home/End from the browser, so a
    // document-level keydown listener would only steal those keys from the rest of the app.
    // Comments are stripped first so a comment that *mentions* keydown cannot trip the guard.
    const code = `${resultSource}\n${panelSource}`
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

    expect(code).not.toMatch(/keydown|onKeyDown|onKeyUp|onKeyPress/i);
    expect(code).not.toMatch(/addEventListener\(\s*["'`]key/);
    // Native keyboard scrolling only works because the region is reachable by Tab and named.
    expect(code).toMatch(/tabIndex=\{0\}/);
    expect(code).toMatch(/aria-label="[^"]+"/);
  });

  // U12 ----------------------------------------------------------- definite-row geometry contract
  test("the bounded layout declares a definite grid row on the safe frame", () => {
    // globals.css lays `.scene-safe-frame` out as `display: grid; grid-template-rows: min-content`,
    // and a min-content row is indefinite — so every `height: 100%` below it (and therefore the
    // whole percentage chain down to the internal scroll region) silently resolves to `auto`. That
    // is why the Result stage grew past the viewport and put a second scrollbar on the scene.
    const block = mediaBlock(moduleCss, "(min-width: 1024px)");
    const frameRule = block.match(
      /:global\(\.scene-canvas\[data-stage="result"\] \.scene-safe-frame\)\{([^}]*)\}/
    );

    expect(frameRule, "no safe-frame contract in the result module").not.toBeNull();
    expect(frameRule?.[1]).toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\)/);
    expect(frameRule?.[1]).toMatch(/height:\s*100%/);
    expect(frameRule?.[1]).toMatch(/min-height:\s*0/);
    expect(block).toMatch(
      /:global\(\.scene-canvas\[data-stage="result"\] \.scene-content\)\{[^}]*height:\s*100%/
    );
    // `1fr` alone would keep the row indefinite for min-content purposes; only `minmax(0, 1fr)` is
    // a definite track that can also shrink below its content.
    expect(frameRule?.[1]).not.toMatch(/grid-template-rows:\s*1fr/);
  });

  test("the comparison grid replaces the three-column bridge layout", () => {
    const desktop = mediaBlock(moduleCss, "(min-width: 1024px)");
    const comparison = desktop.match(
      /:global\(\.scene-canvas\[data-stage="result"\]\)[^{]*\.comparison\{([^}]*)\}/
    );

    expect(comparison, "no desktop comparison grid rule").not.toBeNull();
    const body = comparison![1];
    // Two columns, no bridge column, no gap, and no leftover minmax(240px, …) floor.
    expect(body).toMatch(/grid-template-columns:\s*minmax\(0,[^)]*\)\s*minmax\(0,[^)]*\)/);
    expect(body).not.toMatch(/62px/);
    expect(body).toMatch(/gap:\s*0/);
    expect(body).toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\)/);
    expect(body).toMatch(/flex:\s*1 1 auto/);
  });

  test("the bounded layout is desktop-only and leaves the sub-1024px canvas alone", () => {
    // Below 1024px the scene canvas keeps its ordinary vertical page scroll, the columns stack, and
    // the CTA stays reachable through `.mobile-sticky-actions`. Any bounded-layout rule therefore
    // has to live inside the desktop media block.
    expect(moduleCss).toContain("@media (min-width: 1024px){");
    expect(moduleCss.indexOf("grid-template-rows: minmax(0, 1fr)")).toBeGreaterThan(
      moduleCss.indexOf("@media (min-width: 1024px){")
    );
    expect(moduleCss.indexOf("position: sticky")).toBe(-1);

    // The stacked layout must pin one column, so the mobile path cannot inherit the desktop grid.
    const stacked = mediaBlock(moduleCss, "(max-width: 1023px)");
    const stackedGrid = stacked.match(
      /:global\(\.scene-canvas\[data-stage="result"\]\)[^{]*\.comparison\{([^}]*)\}/
    );
    expect(stackedGrid, "no stacked comparison rule").not.toBeNull();
    expect(stackedGrid?.[1]).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    // The desktop divider is a pseudo-element, so it cannot leak into the stacked layout.
    expect(stacked).not.toContain("::before");
  });

  test("geometry is scoped by stage, never by transition role", () => {
    // stable/outgoing/incoming must share identical box metrics or the scene jumps mid-handoff.
    expect(moduleCss).toContain(':global(.scene-canvas[data-stage="result"]');
    expect(moduleCss).not.toContain("data-scene-role");
  });
});
