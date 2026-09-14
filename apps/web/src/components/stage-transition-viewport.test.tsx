import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { SceneCanvas } from "./scene-canvas";
import { getSceneTransitionDirection } from "./stage-transition-model";
import { SceneTransitionLayers } from "./stage-transition-viewport";

describe("scene transition system", () => {
  test("derives forward and backward direction", () => {
    expect(getSceneTransitionDirection("input", "clarify")).toBe("forward");
    expect(getSceneTransitionDirection("coverage", "diagnose")).toBe("backward");
  });

  test("scene canvas paints backdrop and content in one layer", () => {
    const html = renderToStaticMarkup(
      <SceneCanvas stage="coverage" role="incoming">
        <div>Coverage content</div>
      </SceneCanvas>
    );

    expect(html).toContain('data-scene-role="incoming"');
    expect(html).toContain('data-stage="coverage"');
    expect(html).toContain("stage-backdrop");
    expect(html).toContain("Coverage content");
  });

  test("scene canvas reset keeps light surfaces readable under dark backdrops", () => {
    const css = readFileSync("src/styles/scene-contrast.css", "utf8");

    expect(css).toContain(".scene-canvas");
    expect(css).toContain(".flow-card");
    expect(css).toContain(".workspace-panel");
    expect(css).toContain(".knowledge-card");
    expect(css).toContain(".before-card");
    expect(css).toContain(".result-status");
    expect(css).toContain("color: var(--text-primary)");
  });

  test("transition renders outgoing and incoming complete scenes together", () => {
    const html = renderToStaticMarkup(
      <SceneTransitionLayers
        pair={{
          outgoing: { stage: "input", content: <div>Old input</div> },
          incoming: { stage: "clarify", content: <div>New clarify</div> },
          direction: "forward"
        }}
      />
    );

    expect(html).toContain("Old input");
    expect(html).toContain("New clarify");
    expect(html).toContain('data-scene-role="outgoing"');
    expect(html).toContain('data-scene-role="incoming"');
    expect(html).toContain('data-transition-direction="forward"');
    expect(html).toContain('aria-hidden="true"');
  });

  test("scene shell is one viewport and generic stage entrance is removed", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain("height: 100dvh");
    expect(css).toContain(".scene-transition-viewport");
    expect(css).toContain(".scene-canvas");
    expect(css).toContain("overflow: hidden");
    expect(css).not.toContain("animation: stage-enter 260ms");
  });

  test("scene system keeps reduced motion and mobile safe-area rules", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("100dvh");
  });

  test("transition canvases take no pointer events during the handoff", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain('.scene-canvas[data-scene-role="outgoing"]');
    expect(css).toContain('.scene-canvas[data-scene-role="incoming"]');
    expect(css).toContain("pointer-events: none");
  });

  test("viewport uses shorter mobile travel and keeps the full-scene crossfade for reduced motion", () => {
    const source = readFileSync("src/components/stage-transition-viewport.tsx", "utf8");

    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toMatch(/matchMedia/);
    expect(source).toContain("28");
  });

  test("scene safe frame scrolls instead of clipping primary actions", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const frame = css.slice(css.indexOf(".scene-safe-frame{"));
    const frameRule = frame.slice(0, frame.indexOf("}"));

    // Content taller than the frame must be reachable: top-aligned and scrollable,
    // never vertically centered into a clipped, unreachable state.
    expect(frameRule).toContain("align-content: start");
    expect(frameRule).toContain("overflow-y: auto");
    // Short compositions are still centered.
    expect(css).toContain('.scene-canvas[data-scene-role="stable"] .scene-safe-frame{');

    // Long compositions are bounded so the primary action row stays inside the viewport.
    const grid = css.slice(css.indexOf(".knowledge-grid{"));
    expect(grid.slice(0, grid.indexOf("}"))).toContain("max-height");

    const comparison = css.slice(css.indexOf(".scene-content > .flow-stage-wide > .before-after-grid{"));
    const comparisonRule = comparison.slice(0, comparison.indexOf("}"));
    expect(comparisonRule).toContain("max-height");
    expect(css).toContain("min-height: 240px");

    // The compiled panel keeps its CTAs outside the scrolling body.
    expect(css).toContain(".compiled-panel-body{");
  });
});
