import { describe, expect, test } from "vitest";
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
});
