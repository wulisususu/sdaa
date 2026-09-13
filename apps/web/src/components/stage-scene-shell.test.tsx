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
});
