import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StageSceneShell } from "./stage-scene-shell";
import { motionTokens, stageVisuals } from "../lib/stage-visuals";

describe("stage visuals", () => {
  test("defines a visual theme for all five stages", () => {
    expect(Object.keys(stageVisuals)).toEqual([
      "input", "clarify", "diagnose", "coverage", "result"
    ]);
  });

  test("keeps the scene motion budget below one second", () => {
    expect(motionTokens.scene).toBe(0.76);
  });

  test("keeps reduced motion to a short opacity reveal", () => {
    expect(motionTokens.reduced).toBe(0.16);
  });

  test("scene shell exposes stage identity without changing content semantics", () => {
    const html = renderToStaticMarkup(
      <StageSceneShell stage="coverage" previousStage="diagnose">
        <div>Evidence content</div>
      </StageSceneShell>
    );
    expect(html).toContain('data-stage="coverage"');
    expect(html).toContain("stage-backdrop");
    expect(html).toContain("Evidence content");
  });

  test("derives visual transition direction from adjacent stages", () => {
    const forward = renderToStaticMarkup(
      <StageSceneShell stage="coverage" previousStage="diagnose">content</StageSceneShell>
    );
    const backward = renderToStaticMarkup(
      <StageSceneShell stage="diagnose" previousStage="coverage">content</StageSceneShell>
    );

    expect(forward).toContain('data-stage-direction="forward"');
    expect(backward).toContain('data-stage-direction="backward"');
  });

  test("light surface cards reset scene foreground to readable dark text", () => {
    const css = readFileSync("src/styles/scene-contrast.css", "utf8");

    expect(css).toContain(".flow-card");
    expect(css).toContain(".workspace-panel");
    expect(css).toContain(".knowledge-card");
    expect(css).toContain(".before-card");
    expect(css).toContain(".result-status");
    expect(css).toContain("color: var(--text-primary);");
  });
});
