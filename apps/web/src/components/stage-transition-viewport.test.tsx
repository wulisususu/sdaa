import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { SceneCanvas } from "./scene-canvas";
import { getSceneTransitionDirection } from "./stage-transition-model";

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
});
