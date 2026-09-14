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
});
